"""Memory management API routes."""

import logging
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from attacktrace_mcp_host.httpd.dependencies import get_app, get_db_session, get_attacktrace_user
from attacktrace_mcp_host.httpd.middlewares.general import AttackTraceUser
from attacktrace_mcp_host.httpd.routers.models import ResultResponse
from attacktrace_mcp_host.httpd.server import AttackTraceHostAPI
from attacktrace_mcp_host.host.store.memory_store import Entity, EntityType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memory", tags=["memory"])

T = TypeVar("T")


class DataResult[T](ResultResponse):
    """Generic result that extends ResultResponse with a data field."""

    data: T | None


class EntityCreateRequest(BaseModel):
    """Request model for creating an entity."""

    name: str = Field(..., description="Entity name")
    entity_type: EntityType = Field(..., description="Entity type")
    content: str = Field(..., description="Entity description or context")
    metadata: dict = Field(default_factory=dict, description="Additional metadata")
    relevance: float = Field(default=0.8, ge=0.0, le=1.0, description="Relevance score")


class EntityUpdateRequest(BaseModel):
    """Request model for updating an entity."""

    content: str | None = Field(None, description="Updated description")
    metadata: dict | None = Field(None, description="Updated metadata")
    relevance: float | None = Field(None, ge=0.0, le=1.0, description="Updated relevance")


class EntityResponse(BaseModel):
    """Response model for an entity."""

    name: str
    entity_type: str
    content: str
    metadata: dict
    created_at: str
    updated_at: str
    relevance: float
    source_chat_id: str | None = None


class EntitiesListResponse(BaseModel):
    """Response model for list of entities."""

    entities: list[EntityResponse]
    total: int


class MemoryStatsResponse(BaseModel):
    """Response model for memory statistics."""

    total: int
    person: int = 0
    project: int = 0
    concept: int = 0
    infrastructure: int = 0
    index: int = 0
    other: int = 0


@router.get("/entities", response_model=DataResult[EntitiesListResponse])
async def get_entities(
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: AttackTraceUser = Depends(get_attacktrace_user),
    db_session: AsyncSession = Depends(get_db_session),
    entity_type: Annotated[EntityType | None, Query()] = None,
) -> DataResult[EntitiesListResponse]:
    """Get all entities or entities of a specific type.

    Args:
        app: Application instance.
        dive_user: Current user.
        db_session: Database session.
        entity_type: Optional entity type filter.

    Returns:
        List of entities.
    """
    try:
        if not app.long_term_memory_store:
            raise HTTPException(status_code=501, detail="Long-term memory not enabled")

        memory_store = app.long_term_memory_store
        user_id = dive_user.get("user_id") or "default"
        
        logger.info(f"🔍 [Memory API] Getting entities for user '{user_id}', type: {entity_type}")
        
        # Set database session for this request
        memory_store._db_session = db_session
        
        # Load entities from database into memory store if not already loaded
        await memory_store.load_from_database(user_id)
        
        entities = await memory_store.get_entities(
            user_id=user_id,
            entity_type=entity_type,
        )
        
        logger.info(f"🔍 [Memory API] Found {len(entities)} entities")

        entity_responses = [
            EntityResponse(
                name=e.name,
                entity_type=e.entity_type.value,
                content=e.content,
                metadata=e.metadata,
                created_at=e.created_at.isoformat(),
                updated_at=e.updated_at.isoformat(),
                relevance=e.relevance,
                source_chat_id=e.source_chat_id,
            )
            for e in entities
        ]
        
        logger.info(f"🔍 [Memory API] Returning {len(entity_responses)} entity responses")

        return DataResult(
            success=True,
            data=EntitiesListResponse(
                entities=entity_responses,
                total=len(entity_responses),
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get entities: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/search", response_model=DataResult[EntitiesListResponse])
async def search_entities(
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: AttackTraceUser = Depends(get_attacktrace_user),
    db_session: AsyncSession = Depends(get_db_session),
    q: Annotated[str, Query(min_length=1)] = "",
    entity_type: Annotated[EntityType | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 50,
) -> DataResult[EntitiesListResponse]:
    """Search entities by name or content (case-insensitive, partial match).

    Args:
        app: Application instance.
        dive_user: Current user.
        db_session: Database session.
        q: Search query (searches in both name and content).
        entity_type: Optional entity type filter.
        limit: Maximum number of results.

    Returns:
        List of matching entities sorted by relevance.
    """
    try:
        if not app.long_term_memory_store:
            raise HTTPException(status_code=501, detail="Long-term memory not enabled")

        memory_store = app.long_term_memory_store
        user_id = dive_user.get("user_id") or "default"
        
        logger.info(f"🔍 [Memory API] Searching entities for user '{user_id}', query: '{q}', type: {entity_type}")
        
        # Set database session for this request
        memory_store._db_session = db_session
        
        # Load entities from database into memory store if not already loaded
        await memory_store.load_from_database(user_id)
        
        # Get all entities of the specified type (or all types)
        all_entities = await memory_store.get_entities(
            user_id=user_id,
            entity_type=entity_type,
        )
        
        # Filter entities by search query (case-insensitive partial match)
        query_lower = q.lower()
        matching_entities = []
        
        for entity in all_entities:
            name_match = query_lower in entity.name.lower()
            content_match = query_lower in entity.content.lower()
            
            if name_match or content_match:
                # Calculate match score: name match scores higher
                score = entity.relevance
                if name_match:
                    score += 0.5
                if content_match:
                    score += 0.2
                
                matching_entities.append((entity, score))
        
        # Sort by score (descending) and limit results
        matching_entities.sort(key=lambda x: x[1], reverse=True)
        entities = [e for e, _ in matching_entities[:limit]]
        
        logger.info(f"🔍 [Memory API] Found {len(entities)} matching entities")

        entity_responses = [
            EntityResponse(
                name=e.name,
                entity_type=e.entity_type.value,
                content=e.content,
                metadata=e.metadata,
                created_at=e.created_at.isoformat(),
                updated_at=e.updated_at.isoformat(),
                relevance=e.relevance,
                source_chat_id=e.source_chat_id,
            )
            for e in entities
        ]

        return DataResult(
            success=True,
            data=EntitiesListResponse(
                entities=entity_responses,
                total=len(entity_responses),
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to search entities: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/entities", response_model=DataResult[EntityResponse])
async def create_entity(
    request: EntityCreateRequest,
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: AttackTraceUser = Depends(get_attacktrace_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DataResult[EntityResponse]:
    """Create a new entity.

    Args:
        request: Entity creation request.
        app: Application instance.
        dive_user: Current user.
        db_session: Database session.

    Returns:
        Created entity.
    """
    try:
        if not app.long_term_memory_store:
            raise HTTPException(status_code=501, detail="Long-term memory not enabled")

        memory_store = app.long_term_memory_store
        user_id = dive_user.get("user_id") or "default"
        
        # Set database session for this request
        memory_store._db_session = db_session

        # Check if entity already exists
        existing = await memory_store.get_entity(
            user_id=user_id,
            entity_type=request.entity_type,
            entity_name=request.name,
        )

        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Entity '{request.name}' of type '{request.entity_type}' already exists",
            )

        entity = Entity(
            name=request.name,
            entity_type=request.entity_type,
            content=request.content,
            metadata=request.metadata,
            relevance=request.relevance,
        )

        await memory_store.save_entity(user_id=user_id, entity=entity)

        return DataResult(
            success=True,
            data=EntityResponse(
                name=entity.name,
                entity_type=entity.entity_type.value,
                content=entity.content,
                metadata=entity.metadata,
                created_at=entity.created_at.isoformat(),
                updated_at=entity.updated_at.isoformat(),
                relevance=entity.relevance,
                source_chat_id=entity.source_chat_id,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create entity: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/entities/{entity_type}/{entity_name}", response_model=DataResult[EntityResponse])
async def update_entity(
    entity_type: EntityType,
    entity_name: str,
    request: EntityUpdateRequest,
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: AttackTraceUser = Depends(get_attacktrace_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DataResult[EntityResponse]:
    """Update an existing entity.

    Args:
        entity_type: Entity type.
        entity_name: Entity name.
        request: Update request.
        app: Application instance.
        dive_user: Current user.
        db_session: Database session.

    Returns:
        Updated entity.
    """
    try:
        if not app.long_term_memory_store:
            raise HTTPException(status_code=501, detail="Long-term memory not enabled")

        memory_store = app.long_term_memory_store
        user_id = dive_user.get("user_id") or "default"
        
        # Set database session for this request
        memory_store._db_session = db_session

        # Build updates dict
        updates = {}
        if request.content is not None:
            updates["content"] = request.content
        if request.metadata is not None:
            updates["metadata"] = request.metadata
        if request.relevance is not None:
            updates["relevance"] = request.relevance

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        entity = await memory_store.update_entity(
            user_id=user_id,
            entity_type=entity_type,
            entity_name=entity_name,
            updates=updates,
        )

        if not entity:
            raise HTTPException(
                status_code=404,
                detail=f"Entity '{entity_name}' of type '{entity_type}' not found",
            )

        return DataResult(
            success=True,
            data=EntityResponse(
                name=entity.name,
                entity_type=entity.entity_type.value,
                content=entity.content,
                metadata=entity.metadata,
                created_at=entity.created_at.isoformat(),
                updated_at=entity.updated_at.isoformat(),
                relevance=entity.relevance,
                source_chat_id=entity.source_chat_id,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update entity: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/entities/{entity_type}/{entity_name}", response_model=DataResult[dict])
async def delete_entity(
    entity_type: EntityType,
    entity_name: str,
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: AttackTraceUser = Depends(get_attacktrace_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DataResult[dict]:
    """Delete an entity.

    Args:
        entity_type: Entity type.
        entity_name: Entity name.
        app: Application instance.
        dive_user: Current user.
        db_session: Database session.

    Returns:
        Success message.
    """
    try:
        if not app.long_term_memory_store:
            raise HTTPException(status_code=501, detail="Long-term memory not enabled")

        memory_store = app.long_term_memory_store
        user_id = dive_user.get("user_id") or "default"
        
        logger.info(f"🗑️ [Memory API] Deleting entity '{entity_name}' of type '{entity_type}' for user '{user_id}'")
        
        # Set database session for this request
        memory_store._db_session = db_session
        
        success = await memory_store.delete_entity(
            user_id=user_id,
            entity_type=entity_type,
            entity_name=entity_name,
        )

        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Entity '{entity_name}' of type '{entity_type}' not found",
            )
        
        logger.info(f"🗑️ [Memory API] Successfully deleted entity '{entity_name}'")

        return DataResult(
            success=True,
            data={"message": "Entity deleted successfully"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete entity: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/entities", response_model=DataResult[dict])
async def delete_all_entities(
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: AttackTraceUser = Depends(get_attacktrace_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DataResult[dict]:
    """Delete all entities for the current user.

    Args:
        app: Application instance.
        dive_user: Current user.
        db_session: Database session.

    Returns:
        Success message with count.
    """
    try:
        if not app.long_term_memory_store:
            raise HTTPException(status_code=501, detail="Long-term memory not enabled")

        memory_store = app.long_term_memory_store
        user_id = dive_user.get("user_id") or "default"
        
        logger.info(f"🗑️ [Memory API] Deleting all entities for user '{user_id}'")
        
        # Set database session for this request
        memory_store._db_session = db_session
        
        count = await memory_store.delete_all_entities(user_id=user_id)
        
        logger.info(f"🗑️ [Memory API] Successfully deleted {count} entities")

        return DataResult(
            success=True,
            data={
                "message": f"Deleted {count} entities successfully",
                "count": count,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete all entities: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/stats", response_model=DataResult[MemoryStatsResponse])
async def get_memory_stats(
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: AttackTraceUser = Depends(get_attacktrace_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> DataResult[MemoryStatsResponse]:
    """Get memory statistics for the current user.

    Args:
        app: Application instance.
        dive_user: Current user.
        db_session: Database session.

    Returns:
        Memory statistics.
    """
    try:
        if not app.long_term_memory_store:
            raise HTTPException(status_code=501, detail="Long-term memory not enabled")

        memory_store = app.long_term_memory_store
        user_id = dive_user.get("user_id") or "default"
        
        logger.info(f"🔍 [Memory API] Getting stats for user '{user_id}'")
        
        # Set database session for this request
        memory_store._db_session = db_session
        
        # Load entities from database into memory store if not already loaded
        await memory_store.load_from_database(user_id)
        
        stats = await memory_store.get_stats(user_id=user_id)
        
        logger.info(f"🔍 [Memory API] Stats: {stats}")

        return DataResult(
            success=True,
            data=MemoryStatsResponse(**stats),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get memory stats: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

