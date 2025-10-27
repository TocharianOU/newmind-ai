"""Entity extraction agent for long-term memory."""

import logging
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from dive_mcp_host.host.store.memory_store import Entity, EntityType

logger = logging.getLogger(__name__)


class ExtractedEntity(BaseModel):
    """Extracted entity from conversation."""

    name: str = Field(..., description="Entity name")
    entity_type: str = Field(..., description="Entity type")
    content: str = Field(..., description="Entity description or context")
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    relevance: float = Field(
        default=0.8, ge=0.0, le=1.0, description="Relevance score (0-1)"
    )


class ExtractedEntities(BaseModel):
    """Collection of extracted entities."""

    entities: list[ExtractedEntity] = Field(
        default_factory=list, description="List of extracted entities"
    )


ENTITY_EXTRACTION_PROMPT = """You are an expert entity extraction system. Your task is to extract important entities from the conversation that should be remembered for future reference.

Extract the following types of entities:
1. **person**: People mentioned in the conversation (names, roles, relationships)
2. **project**: Projects, systems, or applications being discussed
3. **concept**: Important concepts, technologies, or methodologies
4. **infrastructure**: Servers, databases, clusters, services, or infrastructure components
5. **index**: Database indexes, document indexes, or data structures

For each entity, provide:
- **name**: The entity identifier or name
- **entity_type**: One of the types above
- **content**: A brief description of what this entity is and why it's important
- **metadata**: Any relevant additional information (e.g., version, location, status)
- **relevance**: A score from 0-1 indicating how important this entity is to remember

Guidelines:
- Only extract entities that are likely to be referenced in future conversations
- Focus on concrete, specific entities rather than generic concepts
- If infrastructure components are mentioned (e.g., "Elasticsearch cluster", "PostgreSQL database"), extract them
- If someone mentions "my Elasticsearch cluster at 192.168.1.10", extract the specific instance
- For indexes, include information about what they contain and where they are
- Provide clear, concise descriptions
- Assign higher relevance (0.8-1.0) to frequently referenced or critical entities

Examples:
- Person: "John Smith, the team lead for the backend API project"
- Project: "CustomerAPI - REST API for customer management, version 2.1"
- Infrastructure: "prod-elasticsearch-cluster - Production Elasticsearch cluster at es.company.com:9200, 5 nodes"
- Index: "user-logs-2024 - Elasticsearch index containing user activity logs, 2M documents"
- Concept: "Event-driven architecture - System design pattern used for microservices communication"

Now extract entities from the following conversation messages:
"""


class EntityExtractor:
    """Extract entities from conversation for long-term memory."""

    def __init__(self, model: BaseChatModel) -> None:
        """Initialize entity extractor.

        Args:
            model: Language model for entity extraction.
        """
        self._model = model
        self._extraction_model = model.with_structured_output(ExtractedEntities)

    async def extract_entities_from_messages(
        self,
        messages: list[BaseMessage],
        chat_id: str | None = None,
    ) -> list[Entity]:
        """Extract entities from conversation messages.

        Args:
            messages: Conversation messages to extract entities from.
            chat_id: Optional chat ID for tracking source.

        Returns:
            List of extracted entities.
        """
        if not messages:
            return []

        # Filter to only user and assistant messages
        relevant_messages = [
            msg
            for msg in messages
            if msg.type in ("human", "ai")
            and msg.content
            and len(str(msg.content)) > 10
        ]

        if not relevant_messages:
            return []

        # Prepare extraction prompt
        conversation_text = self._format_messages_for_extraction(relevant_messages)

        extraction_messages = [
            SystemMessage(content=ENTITY_EXTRACTION_PROMPT),
            HumanMessage(content=conversation_text),
        ]

        try:
            # Extract entities using structured output
            result = await self._extraction_model.ainvoke(extraction_messages)

            # Convert to Entity objects
            entities = []
            for extracted in result.entities:
                try:
                    # Validate entity type
                    entity_type = EntityType(extracted.entity_type.lower())

                    entity = Entity(
                        name=extracted.name,
                        entity_type=entity_type,
                        content=extracted.content,
                        metadata=extracted.metadata,
                        relevance=extracted.relevance,
                        source_chat_id=chat_id,
                    )
                    entities.append(entity)
                except ValueError as e:
                    logger.warning(
                        f"Invalid entity type '{extracted.entity_type}' for entity '{extracted.name}': {e}"
                    )
                except Exception as e:
                    logger.error(f"Failed to create entity from extraction: {e}")

            logger.info(f"Extracted {len(entities)} entities from conversation")
            return entities

        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            return []

    def _format_messages_for_extraction(
        self, messages: list[BaseMessage], max_messages: int = 20
    ) -> str:
        """Format messages for entity extraction.

        Args:
            messages: Messages to format.
            max_messages: Maximum number of messages to include.

        Returns:
            Formatted conversation text.
        """
        # Take the most recent messages
        recent_messages = messages[-max_messages:] if len(messages) > max_messages else messages

        formatted_lines = []
        for msg in recent_messages:
            role = "User" if msg.type == "human" else "Assistant"
            content = str(msg.content)[:1000]  # Limit content length
            formatted_lines.append(f"{role}: {content}")

        return "\n\n".join(formatted_lines)

    async def should_extract_entities(
        self, messages: list[BaseMessage], threshold: int = 5
    ) -> bool:
        """Determine if entity extraction should be performed.

        Args:
            messages: Conversation messages.
            threshold: Minimum number of substantial messages to trigger extraction.

        Returns:
            True if extraction should be performed.
        """
        # Count substantial messages (user + assistant, with meaningful content)
        substantial_count = sum(
            1
            for msg in messages
            if msg.type in ("human", "ai")
            and msg.content
            and len(str(msg.content)) > 50
        )

        return substantial_count >= threshold


class SimpleEntityExtractor:
    """Simple rule-based entity extractor (fallback when LLM is not available)."""

    def __init__(self) -> None:
        """Initialize simple extractor."""
        self._infrastructure_keywords = {
            "elasticsearch",
            "kibana",
            "postgresql",
            "postgres",
            "mysql",
            "mongodb",
            "redis",
            "kafka",
            "cluster",
            "database",
            "server",
            "service",
        }

    async def extract_entities_from_messages(
        self,
        messages: list[BaseMessage],
        chat_id: str | None = None,
    ) -> list[Entity]:
        """Extract entities using simple keyword matching.

        Args:
            messages: Conversation messages.
            chat_id: Optional chat ID for tracking source.

        Returns:
            List of extracted entities.
        """
        entities = []
        content_texts = []

        # Collect message content
        for msg in messages:
            if msg.type in ("human", "ai") and msg.content:
                content_texts.append(str(msg.content).lower())

        combined_text = " ".join(content_texts)

        # Extract infrastructure entities
        for keyword in self._infrastructure_keywords:
            if keyword in combined_text:
                entity = Entity(
                    name=keyword,
                    entity_type=EntityType.INFRASTRUCTURE,
                    content=f"Infrastructure component: {keyword}",
                    relevance=0.5,
                    source_chat_id=chat_id,
                )
                entities.append(entity)

        logger.info(
            f"Simple extraction found {len(entities)} entities from conversation"
        )
        return entities

