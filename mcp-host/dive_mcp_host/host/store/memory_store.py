"""Long-term memory store implementation using LangGraph InMemoryStore."""

import json
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Self

from langgraph.store.base import BaseStore
from pydantic import BaseModel, Field
from sqlalchemy import select, delete as sqla_delete
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class EntityType(StrEnum):
    """Entity types for long-term memory."""

    PERSON = "person"
    PROJECT = "project"
    CONCEPT = "concept"
    INFRASTRUCTURE = "infrastructure"
    INDEX = "index"
    OTHER = "other"


class Entity(BaseModel):
    """Entity model for long-term memory."""

    name: str = Field(..., description="Entity name")
    entity_type: EntityType = Field(..., description="Entity type")
    content: str = Field(..., description="Entity description or context")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    relevance: float = Field(default=1.0, description="Relevance score (0-1)")
    source_chat_id: str | None = Field(None, description="Source chat ID")


class LongTermMemoryStore:
    """Long-term memory store using LangGraph InMemoryStore with database persistence."""

    def __init__(self, store: BaseStore, db_session: AsyncSession | None = None) -> None:
        """Initialize the long-term memory store.

        Args:
            store: LangGraph BaseStore instance for in-memory storage.
            db_session: SQLAlchemy AsyncSession for database persistence.
        """
        self._store = store
        self._db_session = db_session

    def _get_namespace(self, user_id: str, entity_type: EntityType) -> tuple[str, ...]:
        """Get namespace for entity storage.

        Args:
            user_id: User ID.
            entity_type: Entity type.

        Returns:
            Namespace tuple (must be tuple for InMemoryStore).
        """
        return ("user", user_id, "entities", entity_type.value)

    async def save_entity(
        self,
        user_id: str,
        entity: Entity,
    ) -> None:
        """Save an entity to long-term memory and database.

        Args:
            user_id: User ID.
            entity: Entity to save.
        """
        namespace = self._get_namespace(user_id, entity.entity_type)
        entity.updated_at = datetime.now(UTC)

        # Save to in-memory store
        await self._store.aput(
            namespace=namespace,
            key=entity.name,
            value=entity.model_dump(mode="json"),
        )
        
        # Also save to database if available
        if self._db_session:
            await self._save_to_database(user_id, entity)
        
        logger.debug(
            f"Saved entity: {entity.name} (type: {entity.entity_type}) for user {user_id}"
        )

    async def get_entity(
        self,
        user_id: str,
        entity_type: EntityType,
        entity_name: str,
    ) -> Entity | None:
        """Get a specific entity from long-term memory.

        Args:
            user_id: User ID.
            entity_type: Entity type.
            entity_name: Entity name.

        Returns:
            Entity if found, None otherwise.
        """
        namespace = self._get_namespace(user_id, entity_type)
        result = await self._store.aget(namespace=namespace, key=entity_name)

        if result and result.value:
            return Entity.model_validate(result.value)
        return None

    async def get_entities(
        self,
        user_id: str,
        entity_type: EntityType | None = None,
    ) -> list[Entity]:
        """Get all entities of a specific type or all entities.

        Args:
            user_id: User ID.
            entity_type: Entity type filter (optional).

        Returns:
            List of entities.
        """
        entities = []

        if entity_type:
            types = [entity_type]
        else:
            types = list(EntityType)

        for etype in types:
            namespace = self._get_namespace(user_id, etype)
            # asearch requires namespace_prefix as positional argument
            results = await self._store.asearch(namespace)

            for item in results:
                if item.value:
                    try:
                        entity = Entity.model_validate(item.value)
                        entities.append(entity)
                    except Exception as e:
                        logger.warning(f"Failed to parse entity {item.key}: {e}")

        # Sort by updated_at descending
        entities.sort(key=lambda x: x.updated_at, reverse=True)
        return entities

    async def search_entities(
        self,
        user_id: str,
        query: str,
        entity_type: EntityType | None = None,
        limit: int = 10,
    ) -> list[Entity]:
        """Search entities by name or content.

        Args:
            user_id: User ID.
            query: Search query.
            entity_type: Entity type filter (optional).
            limit: Maximum number of results.

        Returns:
            List of matching entities.
        """
        all_entities = await self.get_entities(user_id, entity_type)

        # Simple keyword matching (can be enhanced with semantic search)
        query_lower = query.lower()
        matched = []

        for entity in all_entities:
            score = 0.0

            # Match in name (higher weight)
            if query_lower in entity.name.lower():
                score += 2.0

            # Match in content
            if query_lower in entity.content.lower():
                score += 1.0

            # Match in metadata
            metadata_str = json.dumps(entity.metadata).lower()
            if query_lower in metadata_str:
                score += 0.5

            if score > 0:
                # Adjust entity relevance based on match score
                entity.relevance = min(1.0, score / 3.0)
                matched.append(entity)

        # Sort by relevance
        matched.sort(key=lambda x: x.relevance, reverse=True)
        return matched[:limit]

    async def update_entity(
        self,
        user_id: str,
        entity_type: EntityType,
        entity_name: str,
        updates: dict[str, Any],
    ) -> Entity | None:
        """Update an existing entity.

        Args:
            user_id: User ID.
            entity_type: Entity type.
            entity_name: Entity name.
            updates: Dictionary of fields to update.

        Returns:
            Updated entity if found, None otherwise.
        """
        entity = await self.get_entity(user_id, entity_type, entity_name)
        if not entity:
            return None

        # Update fields
        for key, value in updates.items():
            if hasattr(entity, key):
                setattr(entity, key, value)

        entity.updated_at = datetime.now(UTC)
        await self.save_entity(user_id, entity)
        return entity

    async def delete_entity(
        self,
        user_id: str,
        entity_type: EntityType,
        entity_name: str,
    ) -> bool:
        """Delete an entity from long-term memory.

        Args:
            user_id: User ID.
            entity_type: Entity type.
            entity_name: Entity name.

        Returns:
            True if deleted, False if not found.
        """
        namespace = self._get_namespace(user_id, entity_type)

        try:
            await self._store.adelete(namespace=namespace, key=entity_name)
            logger.debug(
                f"Deleted entity: {entity_name} (type: {entity_type}) for user {user_id} from in-memory store"
            )

            # Also delete from database if available
            if self._db_session:
                await self._delete_from_database(user_id, entity_type, entity_name)

            return True
        except Exception as e:
            logger.error(f"Failed to delete entity {entity_name}: {e}")
            return False

    async def delete_all_entities(self, user_id: str) -> int:
        """Delete all entities for a user.

        Args:
            user_id: User ID.

        Returns:
            Number of entities deleted.
        """
        count = 0
        for entity_type in EntityType:
            entities = await self.get_entities(user_id, entity_type)
            for entity in entities:
                if await self.delete_entity(user_id, entity_type, entity.name):
                    count += 1

        # Bulk delete from database as well (faster than per-entity)
        if self._db_session:
            await self._delete_all_from_database(user_id)

        logger.info(f"Deleted {count} entities for user {user_id}")
        return count

    async def get_stats(self, user_id: str) -> dict[str, int]:
        """Get statistics about stored entities.

        Args:
            user_id: User ID.

        Returns:
            Dictionary with entity counts by type.
        """
        stats: dict[str, int] = {}
        total = 0

        for entity_type in EntityType:
            entities = await self.get_entities(user_id, entity_type)
            count = len(entities)
            stats[entity_type.value] = count
            total += count

        stats["total"] = total
        return stats
    
    async def _save_to_database(self, user_id: str, entity: Entity) -> None:
        """Save entity to database.
        
        Args:
            user_id: User ID.
            entity: Entity to save.
        """
        if not self._db_session:
            return
            
        try:
            from dive_mcp_host.httpd.database.orm_models import LongTermMemory
            
            # Check if entity already exists
            stmt = select(LongTermMemory).where(
                LongTermMemory.user_id == user_id,
                LongTermMemory.entity_name == entity.name,
                LongTermMemory.entity_type == entity.entity_type.value,
            )
            result = await self._db_session.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update existing
                existing.content = entity.content
                existing.entity_metadata = entity.metadata
                existing.relevance = entity.relevance
                existing.source_chat_id = entity.source_chat_id
                existing.updated_at = entity.updated_at
            else:
                # Create new
                memory = LongTermMemory(
                    user_id=user_id,
                    entity_type=entity.entity_type.value,
                    entity_name=entity.name,
                    content=entity.content,
                    entity_metadata=entity.metadata,
                    relevance=entity.relevance,
                    source_chat_id=entity.source_chat_id,
                    created_at=entity.created_at,
                    updated_at=entity.updated_at,
                )
                self._db_session.add(memory)
            
            await self._db_session.commit()
            logger.debug(f"Saved entity {entity.name} to database")
        except Exception as e:
            logger.error(f"Failed to save entity {entity.name} to database: {e}")
            if self._db_session:
                await self._db_session.rollback()
    
    async def _delete_from_database(
        self, user_id: str, entity_type: EntityType, entity_name: str
    ) -> None:
        """Delete a single entity from database.
        
        Args:
            user_id: User ID.
            entity_type: Entity type.
            entity_name: Entity name.
        """
        if not self._db_session:
            return
        try:
            from dive_mcp_host.httpd.database.orm_models import LongTermMemory

            stmt = sqla_delete(LongTermMemory).where(
                LongTermMemory.user_id == user_id,
                LongTermMemory.entity_type == entity_type.value,
                LongTermMemory.entity_name == entity_name,
            )
            await self._db_session.execute(stmt)
            await self._db_session.commit()
            logger.debug(
                f"Deleted entity {entity_name} (type: {entity_type}) for user {user_id} from database"
            )
        except Exception as e:
            logger.error(
                f"Failed to delete entity {entity_name} (type: {entity_type}) from database: {e}"
            )
            if self._db_session:
                await self._db_session.rollback()
    
    async def _delete_all_from_database(self, user_id: str) -> None:
        """Delete all entities for a user from database."""
        if not self._db_session:
            return
        try:
            from dive_mcp_host.httpd.database.orm_models import LongTermMemory

            stmt = sqla_delete(LongTermMemory).where(LongTermMemory.user_id == user_id)
            await self._db_session.execute(stmt)
            await self._db_session.commit()
            logger.debug(f"Deleted all entities for user {user_id} from database")
        except Exception as e:
            logger.error(f"Failed to delete all entities for user {user_id} from database: {e}")
            if self._db_session:
                await self._db_session.rollback()
    
    async def load_from_database(self, user_id: str) -> int:
        """Load all entities for a user from database into memory store.
        
        Args:
            user_id: User ID.
            
        Returns:
            Number of entities loaded.
        """
        if not self._db_session:
            return 0
            
        try:
            from dive_mcp_host.httpd.database.orm_models import LongTermMemory
            
            stmt = select(LongTermMemory).where(LongTermMemory.user_id == user_id)
            result = await self._db_session.execute(stmt)
            memories = result.scalars().all()
            
            count = 0
            for memory in memories:
                entity = Entity(
                    name=memory.entity_name,
                    entity_type=EntityType(memory.entity_type),
                    content=memory.content,
                    metadata=memory.entity_metadata or {},
                    created_at=memory.created_at,
                    updated_at=memory.updated_at,
                    relevance=memory.relevance,
                    source_chat_id=memory.source_chat_id,
                )
                
                namespace = self._get_namespace(user_id, entity.entity_type)
                await self._store.aput(
                    namespace=namespace,
                    key=entity.name,
                    value=entity.model_dump(mode="json"),
                )
                count += 1
            
            logger.info(f"Loaded {count} entities from database for user {user_id}")
            return count
        except Exception as e:
            logger.error(f"Failed to load entities from database: {e}")
            return 0


class LongTermMemoryStoreManager:
    """Manager for long-term memory store lifecycle."""

    def __init__(self, store: BaseStore) -> None:
        """Initialize the manager.

        Args:
            store: LangGraph BaseStore instance.
        """
        self._store = store
        self._memory_store: LongTermMemoryStore | None = None

    @asynccontextmanager
    async def get_memory_store(self) -> Self:
        """Get memory store as async context manager.

        Yields:
            LongTermMemoryStore instance.
        """
        if not self._memory_store:
            self._memory_store = LongTermMemoryStore(self._store)

        try:
            yield self._memory_store
        finally:
            pass  # Cleanup if needed

    @property
    def memory_store(self) -> LongTermMemoryStore:
        """Get memory store instance.

        Returns:
            LongTermMemoryStore instance.

        Raises:
            RuntimeError: If memory store is not initialized.
        """
        if not self._memory_store:
            self._memory_store = LongTermMemoryStore(self._store)
        return self._memory_store

