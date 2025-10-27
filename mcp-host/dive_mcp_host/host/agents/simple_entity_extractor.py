"""Simple rule-based entity extractor as fallback."""

import logging
import re
from datetime import UTC, datetime

from langchain_core.messages import BaseMessage

from dive_mcp_host.host.store.memory_store import Entity, EntityType

logger = logging.getLogger(__name__)


class SimpleEntityExtractor:
    """Simple rule-based entity extractor using regex patterns."""

    def __init__(self) -> None:
        """Initialize the simple entity extractor."""
        # Elasticsearch/Kibana/Database patterns
        self._infra_patterns = [
            (r"(?:Elasticsearch|ES|elastic|elasticsearch)(?:\s+cluster|\s+集群)?", "infrastructure"),
            (r"(?:Kibana|kibana)", "infrastructure"),
            (r"(?:PostgreSQL|MySQL|MongoDB|Redis|Kafka)", "infrastructure"),
            (r"(?:Docker|Kubernetes|K8s)", "infrastructure"),
            (r"(?:Jenkins|CI/CD|gitlab)", "infrastructure"),
        ]

        # Index patterns
        self._index_patterns = [
            (r"(?:logs|metrics|traces|events|data)[-_][a-zA-Z0-9]+", "index"),
            (r"\.ds-[a-zA-Z0-9\-\.]+", "index"),  # data streams
            (r"[a-z]+-\d{4}(?:\.\d{2}){0,2}", "index"),  # logs-2024.01.01
        ]

        # Project patterns  
        self._project_patterns = [
            (r"[A-Z][a-zA-Z]{2,}(?:Project|X|项目)", "project"),
            (r"(?:项目|project)\s*[：:]\s*([A-Za-z0-9]+)", "project"),
        ]

        # Person patterns (capitalized names)
        self._person_patterns = [
            (r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[（(](?:前端|后端|PM|测试|frontend|backend|dev)", "person"),
            (r"(?:团队成员|member|colleague)[：:]\s*([A-Z][a-z]+)", "person"),
        ]

        # Technical concepts
        self._concept_patterns = [
            (r"(?:CQRS|DDD|microservice[s]?|微服务|分布式|RESTful|GraphQL)", "concept"),
            (r"(?:JWT|OAuth|SAML|SSO)", "concept"),
            (r"(?:gRPC|WebSocket|HTTP/2)", "concept"),
        ]

    async def extract_entities_from_messages(
        self,
        messages: list[BaseMessage],
        chat_id: str | None = None,
    ) -> list[Entity]:
        """Extract entities from messages using regex patterns.

        Args:
            messages: Messages to extract from.
            chat_id: Optional chat ID for source tracking.

        Returns:
            List of extracted entities.
        """
        if not messages:
            return []

        # Combine all message content
        text_parts = []
        for msg in messages:
            if msg.type in ("human", "ai") and msg.content:
                text_parts.append(str(msg.content))

        if not text_parts:
            return []

        full_text = " ".join(text_parts)
        logger.info(f"🔍 Extracting entities from text (length: {len(full_text)})")

        entities = []
        seen_entities = set()  # Avoid duplicates

        # Extract infrastructure
        for pattern, entity_type in self._infra_patterns:
            for match in re.finditer(pattern, full_text, re.IGNORECASE):
                name = match.group(0).strip()
                key = (entity_type, name.lower())
                if key not in seen_entities:
                    entities.append(self._create_entity(
                        name=name,
                        entity_type=entity_type,
                        content=f"Infrastructure mentioned in conversation: {name}",
                        relevance=0.8,
                        chat_id=chat_id,
                    ))
                    seen_entities.add(key)

        # Extract indices
        for pattern, entity_type in self._index_patterns:
            for match in re.finditer(pattern, full_text):
                name = match.group(0).strip()
                key = (entity_type, name.lower())
                if key not in seen_entities:
                    entities.append(self._create_entity(
                        name=name,
                        entity_type=entity_type,
                        content=f"Index/data source mentioned: {name}",
                        relevance=0.7,
                        chat_id=chat_id,
                    ))
                    seen_entities.add(key)

        # Extract projects
        for pattern, entity_type in self._project_patterns:
            for match in re.finditer(pattern, full_text):
                name = match.group(1) if match.groups() else match.group(0)
                name = name.strip()
                key = (entity_type, name.lower())
                if key not in seen_entities:
                    entities.append(self._create_entity(
                        name=name,
                        entity_type=entity_type,
                        content=f"Project mentioned in conversation: {name}",
                        relevance=0.9,
                        chat_id=chat_id,
                    ))
                    seen_entities.add(key)

        # Extract persons
        for pattern, entity_type in self._person_patterns:
            for match in re.finditer(pattern, full_text):
                name = match.group(1) if match.groups() else match.group(0)
                name = name.strip()
                # Filter out common non-person words
                if name.lower() not in ("the", "this", "that", "user", "admin"):
                    key = (entity_type, name.lower())
                    if key not in seen_entities:
                        entities.append(self._create_entity(
                            name=name,
                            entity_type=entity_type,
                            content=f"Person mentioned: {name}",
                            relevance=0.8,
                            chat_id=chat_id,
                        ))
                        seen_entities.add(key)

        # Extract concepts
        for pattern, entity_type in self._concept_patterns:
            for match in re.finditer(pattern, full_text, re.IGNORECASE):
                name = match.group(0).strip()
                key = (entity_type, name.lower())
                if key not in seen_entities:
                    entities.append(self._create_entity(
                        name=name,
                        entity_type=entity_type,
                        content=f"Technical concept mentioned: {name}",
                        relevance=0.6,
                        chat_id=chat_id,
                    ))
                    seen_entities.add(key)

        logger.info(f"🔍 Simple extractor found {len(entities)} entities: {[e.name for e in entities]}")
        return entities

    def _create_entity(
        self,
        name: str,
        entity_type: str,
        content: str,
        relevance: float,
        chat_id: str | None,
    ) -> Entity:
        """Create an Entity object.

        Args:
            name: Entity name.
            entity_type: Entity type.
            content: Entity description.
            relevance: Relevance score.
            chat_id: Source chat ID.

        Returns:
            Entity object.
        """
        now = datetime.now(UTC)
        return Entity(
            name=name,
            entity_type=EntityType(entity_type),
            content=content,
            metadata={"source": "simple_extractor"},
            created_at=now,
            updated_at=now,
            relevance=relevance,
            source_chat_id=chat_id,
        )

