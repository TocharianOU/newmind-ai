from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from oap_mcp_host.httpd.database.orm_models import ToolCall


class QueryInput(BaseModel):
    """Represents input for querying operations."""

    text: str | None
    images: list[str] | None
    documents: list[str] | None

    tool_calls: list[ToolCall] = Field(default_factory=list)


class Chat(BaseModel):
    """Represents a chat conversation with its basic properties."""

    id: str
    title: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime | None = Field(alias="updatedAt")
    starred_at: datetime | None = Field(alias="starredAt")
    user_id: str | None


class Role(StrEnum):
    """Role for Messages."""

    ASSISTANT = "assistant"
    USER = "user"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"


class Message(BaseModel):
    """Represents a single message in a chat conversation."""

    id: int
    message_id: str
    content: str
    role: Role
    created_at: datetime = Field(alias="createdAt")
    files: list[str] = Field(default_factory=list)
    tool_calls: list[ToolCall] = Field(default_factory=list)


class NewMessage(BaseModel):
    """Represents a new message to be created."""

    message_id: str = Field(alias="messageId")
    chat_id: str = Field(alias="chatId")
    content: str
    role: Role
    created_at: datetime = Field(alias="createdAt", default_factory=lambda: datetime.now(UTC))
    files: list[str] = Field(default_factory=list)
    tool_calls: list[ToolCall] = Field(default_factory=list, alias="toolCalls")


class ResourceUsage(BaseModel):
    """Resource usage information for a message."""

    model: str
    total_input_tokens: int
    total_output_tokens: int
    total_run_time: float


class ChatMessage(BaseModel):
    """Represents a complete chat conversation with messages."""

    chat: Chat
    messages: list[Message]
    total_messages: int


class SortBy(StrEnum):
    """Sorting options for chat retrieval."""

    CHAT = "chat"
    MESSAGE = "msg"


class DataResult[T](BaseModel):
    """Generic data result wrapper."""

    success: bool
    message: str | None
    data: T | None


class ResultResponse(BaseModel):
    """Standard response format."""

    success: bool
    message: str | None = None