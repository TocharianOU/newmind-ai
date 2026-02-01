"""Memory retriever for intelligent long-term memory access."""

import logging
import re
from typing import Any

from langchain_core.messages import BaseMessage

from attacktrace_mcp_host.host.store.memory_store import Entity, EntityType, LongTermMemoryStore

logger = logging.getLogger(__name__)


class MemoryRetriever:
    """Intelligent memory retrieval for long-term memory."""

    def __init__(self, memory_store: LongTermMemoryStore) -> None:
        """Initialize memory retriever.

        Args:
            memory_store: Long-term memory store.
        """
        self._memory_store = memory_store

        # Keywords that indicate historical reference
        self._historical_keywords = {
            # English
            "before",
            "previous",
            "previously",
            "earlier",
            "last time",
            "remember",
            "recall",
            "mentioned",
            "discussed",
            "talked about",
            "we said",
            # Additional temporal references
            "之前",
            "以前",
            "上次",
            "先前",
            "曾经",
            "记得",
            "提到",
            "讨论",
            "说过",
        }

        # Question words that might indicate memory query
        self._question_indicators = {
            "what",
            "which",
            "where",
            "when",
            "who",
            "how",
            "什么",
            "哪个",
            "哪里",
            "何时",
            "谁",
            "怎么",
            "如何",
        }

    async def should_retrieve_memory(
        self,
        messages: list[BaseMessage],
        current_query: str | None = None,
    ) -> bool:
        """Determine if memory retrieval should be performed.

        Args:
            messages: Recent conversation messages.
            current_query: Current user query (if available).

        Returns:
            True if memory retrieval should be performed.
        """
        # Get the most recent user message
        query_text = current_query or ""
        if not query_text and messages:
            for msg in reversed(messages):
                if msg.type == "human" and msg.content:
                    query_text = str(msg.content)
                    break

        if not query_text:
            return False

        query_lower = query_text.lower()

        # Check for historical keywords
        has_historical_keyword = any(
            keyword in query_lower for keyword in self._historical_keywords
        )

        # Check for question indicators combined with entities
        has_question = any(
            indicator in query_lower for indicator in self._question_indicators
        )

        # If there are explicit historical references, definitely retrieve
        if has_historical_keyword:
            logger.debug("Memory retrieval triggered by historical keyword")
            return True

        # If it's a question about something, might need memory
        if has_question and len(query_lower.split()) > 3:
            logger.debug("Memory retrieval triggered by question pattern")
            return True

        # Check if query mentions potential entity names
        # (This is a simple heuristic - can be enhanced)
        if self._contains_potential_entity_reference(query_text):
            logger.debug("Memory retrieval triggered by potential entity reference")
            return True

        return False

    def _contains_potential_entity_reference(self, query: str) -> bool:
        """Check if query contains potential entity references.

        Args:
            query: User query.

        Returns:
            True if potential entity reference found.
        """
        # Look for capitalized words (potential proper nouns)
        capitalized_words = re.findall(r"\b[A-Z][a-z]+\b", query)
        if len(capitalized_words) >= 2:  # Multiple capitalized words
            return True

        # Look for technical terms
        technical_patterns = [
            r"\b\w+\s+(cluster|database|server|service|index|api)\b",
            r"\b(elasticsearch|kibana|postgres|redis|kafka)\b",
            r"\b\w+\.(com|io|net|org)\b",  # Domain names
            r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",  # IP addresses
        ]

        for pattern in technical_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                return True

        return False

    async def retrieve_relevant_memories(
        self,
        user_id: str,
        messages: list[BaseMessage],
        current_query: str | None = None,
        max_memories: int = 5,
    ) -> list[Entity]:
        """Retrieve relevant memories for the conversation.

        Args:
            user_id: User ID.
            messages: Recent conversation messages.
            current_query: Current user query (if available).
            max_memories: Maximum number of memories to retrieve.

        Returns:
            List of relevant entities.
        """
        # Get the query text
        query_text = current_query or ""
        if not query_text and messages:
            for msg in reversed(messages):
                if msg.type == "human" and msg.content:
                    query_text = str(msg.content)
                    break

        if not query_text:
            return []

        # Extract keywords from query
        keywords = self._extract_keywords(query_text)

        if not keywords:
            logger.debug("No keywords extracted from query, skipping memory retrieval")
            return []

        # Search for relevant entities
        all_relevant = []
        for keyword in keywords[:3]:  # Use top 3 keywords
            try:
                entities = await self._memory_store.search_entities(
                    user_id=user_id,
                    query=keyword,
                    limit=max_memories,
                )
                all_relevant.extend(entities)
            except Exception as e:
                logger.error(f"Failed to search entities for keyword '{keyword}': {e}")

        # Deduplicate by name
        seen_names = set()
        unique_entities = []
        for entity in all_relevant:
            if entity.name not in seen_names:
                seen_names.add(entity.name)
                unique_entities.append(entity)

        # Sort by relevance and return top N
        unique_entities.sort(key=lambda e: e.relevance, reverse=True)
        result = unique_entities[:max_memories]

        logger.info(
            f"Retrieved {len(result)} relevant memories for query: '{query_text[:50]}...'"
        )
        return result

    def _extract_keywords(self, text: str) -> list[str]:
        """Extract important keywords from text.

        Args:
            text: Text to extract keywords from.

        Returns:
            List of keywords.
        """
        # Remove common stop words
        stop_words = {
            "the",
            "a",
            "an",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "being",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "can",
            "of",
            "in",
            "on",
            "at",
            "to",
            "for",
            "with",
            "about",
            "这",
            "那",
            "是",
            "的",
            "了",
            "在",
            "有",
            "和",
        }

        # Split into words and filter
        words = re.findall(r"\b\w+\b", text.lower())
        keywords = [
            word
            for word in words
            if word not in stop_words and len(word) > 2
        ]

        # Also extract capitalized phrases (potential entities)
        capitalized_phrases = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", text)
        keywords.extend([phrase.lower() for phrase in capitalized_phrases])

        # Remove duplicates while preserving order
        seen = set()
        unique_keywords = []
        for keyword in keywords:
            if keyword not in seen:
                seen.add(keyword)
                unique_keywords.append(keyword)

        return unique_keywords[:10]  # Return top 10 keywords

    def format_memories_for_context(
        self,
        entities: list[Entity],
        max_length: int = 1000,
    ) -> str:
        """Format retrieved memories for injection into conversation context.

        Args:
            entities: Retrieved entities.
            max_length: Maximum total length of formatted context.

        Returns:
            Formatted memory context.
        """
        if not entities:
            return ""

        lines = ["<relevant_memory>", "The following information from previous conversations may be relevant:", ""]

        current_length = sum(len(line) for line in lines)

        for entity in entities:
            entity_text = f"- **{entity.name}** ({entity.entity_type.value}): {entity.content}"

            if entity.metadata:
                # Add key metadata
                metadata_str = ", ".join(
                    f"{k}: {v}" for k, v in list(entity.metadata.items())[:3]
                )
                if metadata_str:
                    entity_text += f" [{metadata_str}]"

            if current_length + len(entity_text) > max_length:
                break

            lines.append(entity_text)
            current_length += len(entity_text)

        lines.append("</relevant_memory>")

        return "\n".join(lines)

    async def get_recent_memories(
        self,
        user_id: str,
        entity_type: EntityType | None = None,
        limit: int = 10,
    ) -> list[Entity]:
        """Get recent memories for a user.

        Args:
            user_id: User ID.
            entity_type: Optional entity type filter.
            limit: Maximum number of memories to return.

        Returns:
            List of recent entities.
        """
        try:
            entities = await self._memory_store.get_entities(
                user_id=user_id,
                entity_type=entity_type,
            )
            return entities[:limit]
        except Exception as e:
            logger.error(f"Failed to get recent memories: {e}")
            return []

    async def get_memory_stats(self, user_id: str) -> dict[str, Any]:
        """Get statistics about user's memories.

        Args:
            user_id: User ID.

        Returns:
            Dictionary with memory statistics.
        """
        try:
            stats = await self._memory_store.get_stats(user_id)
            return stats
        except Exception as e:
            logger.error(f"Failed to get memory stats: {e}")
            return {"total": 0}

