import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import delete, desc, exists, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from attacktrace_mcp_host.httpd.database.encryption import get_encryption_manager
from attacktrace_mcp_host.httpd.database.models import (
    Chat,
    ChatMessage,
    Message,
    NewMessage,
    QueryInput,
    ResourceUsage,
    Role,
)
from attacktrace_mcp_host.httpd.database.orm_models import Chat as ORMChat
from attacktrace_mcp_host.httpd.database.orm_models import Message as ORMMessage
from attacktrace_mcp_host.httpd.database.orm_models import (
    ResourceUsage as ORMResourceUsage,
)
from attacktrace_mcp_host.httpd.conf.project_context import get_current_project_id
from attacktrace_mcp_host.httpd.routers.models import SortBy

from .abstract import AbstractMessageStore

if TYPE_CHECKING:
    from collections.abc import Sequence


class BaseMessageStore(AbstractMessageStore):
    """
    Base message store implementation.

    This class provides common functionality for database operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize the message store.

        Args:
            session: Database session.
        """
        self._session = session
        # Encryption is scoped to the current project so that each project's
        # data is protected by an independent key stored in the OS keychain.
        project_id = get_current_project_id()
        self._enc = get_encryption_manager(project_id)

    # ── Encryption helpers ─────────────────────────────────────────────────

    def _encrypt(self, plaintext: str) -> str:
        """Encrypt a string field value before persisting to SQLite."""
        if not plaintext:
            return plaintext
        return self._enc.encrypt(plaintext)

    def _decrypt(self, value: str) -> str:
        """Decrypt a string field value read from SQLite.

        Falls back to the original value when decryption fails so that
        pre-encryption (legacy) rows are returned as-is without errors.
        """
        if not value:
            return value
        return self._enc.decrypt(value)

    async def get_all_chats(
        self,
        user_id: str | None = None,
        sort_by: SortBy = SortBy.CHAT,
    ) -> list[Chat]:
        """Retrieve all chats from the database.

        Args:
            user_id: User ID or fingerprint, depending on the prefix.
            sort_by: Sort by.
                - 'chat': Sort by chat creation time.
                - 'msg': Sort by message creation time.
                default: 'chat'

        Starred chat will always be at top.

        Returns:
            List of Chat objects.
        """
        if sort_by == SortBy.MESSAGE:
            query = (
                select(
                    ORMChat,
                    func.coalesce(
                        func.max(ORMMessage.created_at), ORMChat.created_at
                    ).label("last_message_at"),
                )
                .outerjoin(ORMMessage, ORMChat.id == ORMMessage.chat_id)
                .group_by(
                    ORMChat.id,
                    ORMChat.title,
                    ORMChat.created_at,
                    ORMChat.user_id,
                )
                .where(ORMChat.user_id == user_id)
                .order_by(desc(ORMChat.starred_at))
                .order_by(desc("last_message_at"))
            )
            result = await self._session.execute(query)
            chats: Sequence[ORMChat] = result.scalars().all()

        elif sort_by == SortBy.CHAT:
            query = (
                select(ORMChat)
                .where(ORMChat.user_id == user_id)
                .order_by(desc(ORMChat.starred_at))
                .order_by(desc(ORMChat.created_at))
            )
            result = await self._session.scalars(query)
            chats: Sequence[ORMChat] = result.all()

        else:
            raise ValueError(f"Invalid sort_by value: {sort_by}")

        return [
            Chat(
                id=chat.id,
                title=chat.title,
                createdAt=chat.created_at,
                user_id=chat.user_id,
                updatedAt=chat.updated_at,
                starredAt=chat.starred_at,
            )
            for chat in chats
        ]

    async def patch_chat(
        self,
        chat_id: str,
        user_id: str | None = None,
        title: str | None = None,
        star: bool | None = None,
    ) -> Chat | None:
        """Patch chat.

        Args:
            chat_id: Unique identifier for the chat.
            user_id: User ID or fingerprint, depending on the prefix.
            title: New title for the chat.
            star: Star the chat.

        Returns:
            The updated chat, or None if chat is not found.
        """
        query = update(ORMChat).where(ORMChat.user_id == user_id, ORMChat.id == chat_id)

        current_ts = datetime.now(UTC)
        query = query.values(updated_at=current_ts)
        if star is True:
            query = query.values(starred_at=current_ts)
        elif star is False:
            query = query.values(starred_at=None)
        if title is not None:
            query = query.values(title=title)

        query = query.returning(ORMChat)

        result: ORMChat | None = await self._session.scalar(query)
        if not result:
            return None

        return Chat(
            id=result.id,
            title=result.title,
            createdAt=result.created_at,
            updatedAt=result.updated_at,
            starredAt=result.starred_at,
            user_id=result.user_id,
        )

    async def get_chat_with_messages(
        self,
        chat_id: str,
        user_id: str | None = None,
    ) -> ChatMessage | None:
        """Get a specific chat with its messages.

        Args:
            chat_id: Unique identifier for the chat.
            user_id: User ID or fingerprint, depending on the prefix.

        Returns:
            ChatMessage object containing chat and messages, or None if not found.
        """
        query = (
            select(ORMChat)
            .options(selectinload(ORMChat.messages).selectinload(ORMMessage.resource_usage))
            .where(ORMChat.user_id == user_id)
            .where(ORMChat.id == chat_id)
            .order_by(ORMChat.created_at.desc())
        )
        data = await self._session.scalar(query)
        if data is None:
            return None

        chat = Chat(
            id=data.id,
            title=data.title,
            createdAt=data.created_at,
            updatedAt=data.updated_at,
            starredAt=data.starred_at,
            user_id=data.user_id,
        )
        messages: list[Message] = []
        for msg in data.messages:
            resource_usage = (
                ResourceUsage.model_validate(
                    msg.resource_usage,
                    from_attributes=True,
                )
                if msg.resource_usage
                else None
            )
            tool_calls = msg.tool_calls if msg.tool_calls else []
            raw_files = self._decrypt(msg.files) if msg.files else "[]"
            files = json.loads(raw_files) if raw_files else []

            messages.append(
                Message(
                    id=msg.id,
                    message_id=msg.message_id,
                    content=self._decrypt(msg.content),
                    role=Role(msg.role),
                    createdAt=msg.created_at,
                    files=files,
                    tool_calls=tool_calls,
                )
            )

        return ChatMessage(
            chat=chat,
            messages=messages,
            total_messages=len(messages),
        )

    async def create_message(self, message: NewMessage) -> Message:
        """Create a new message.

        Args:
            message: NewMessage object containing message data.

        Returns:
            Created Message object.
        """
        # Create the message — encrypt sensitive fields before persisting.
        query = insert(ORMMessage).values(
            message_id=message.message_id,
            content=self._encrypt(message.content),
            role=message.role,
            chat_id=message.chat_id,
            created_at=message.created_at,
            files=self._encrypt(json.dumps(message.files) if message.files else "[]"),
            tool_calls=message.tool_calls,
        )
        result = await self._session.execute(query)
        # Keep chat.updated_at aligned with latest message creation time so
        # incremental sync can detect message-only updates reliably.
        await self._session.execute(
            update(ORMChat)
            .where(ORMChat.id == message.chat_id)
            .values(updated_at=message.created_at)
        )
        await self._session.flush()

        # Get the inserted message ID
        message_id = result.inserted_primary_key[0]

        # Return the original (plaintext) values — we encrypted only what goes
        # into the DB; the caller receives the unencrypted representation.
        return Message(
            id=message_id,
            message_id=message.message_id,
            content=message.content,
            role=Role(message.role),
            createdAt=message.created_at,
            files=message.files or [],
            tool_calls=message.tool_calls or [],
        )

    async def create_chat(
        self,
        chat_id: str,
        title: str,
        user_id: str | None = None,
        user_type: str | None = None,
    ) -> Chat | None:
        """Create a new chat.

        Args:
            chat_id: Unique identifier for the chat.
            title: Title of the chat.
            user_id: User ID or fingerprint, depending on the prefix.
            user_type: Optional user type

        Returns:
            Created Chat object or None if creation failed.
        """
        current_ts = datetime.now(UTC)
        query = insert(ORMChat).values(
            id=chat_id,
            title=title,
            created_at=current_ts,
            updated_at=current_ts,
            user_id=user_id,
        )
        await self._session.execute(query)
        return Chat(
            id=chat_id,
            title=title,
            createdAt=current_ts,
            updatedAt=current_ts,
            starredAt=None,
            user_id=user_id,
        )

    async def check_chat_exists(
        self,
        chat_id: str,
        user_id: str | None = None,
    ) -> bool:
        """Check if a chat exists in the database.

        Args:
            chat_id: Unique identifier for the chat.
            user_id: User ID or fingerprint, depending on the prefix.

        Returns:
            True if chat exists, False otherwise.
        """
        query = (
            exists(ORMChat)
            .where(ORMChat.id == chat_id)
            .where(ORMChat.user_id == user_id)
            .select()
        )
        exist = await self._session.scalar(query)
        return bool(exist)

    async def delete_chat(self, chat_id: str, user_id: str | None = None) -> None:
        """Delete a chat from the database.

        Args:
            chat_id: Unique identifier for the chat.
            user_id: User ID or fingerprint, depending on the prefix.
        """
        query = (
            delete(ORMChat)
            .where(ORMChat.id == chat_id)
            .where(ORMChat.user_id == user_id)
        )
        await self._session.execute(query)

    async def delete_messages_after(
        self,
        chat_id: str,
        message_id: str,
    ) -> None:
        """Delete all messages after a specific message in a chat."""
        query = (
            delete(ORMMessage)
            .where(ORMMessage.chat_id == chat_id)
            .where(
                ORMMessage.created_at
                > (
                    select(ORMMessage.created_at)
                    .where(ORMMessage.chat_id == chat_id)
                    .where(ORMMessage.message_id == message_id)
                    .scalar_subquery()
                )
            )
        )
        await self._session.execute(query)

    async def lock_msg(
        self,
        chat_id: str,
        message_id: str,
        user_id: str | None = None,
    ) -> bool:
        """Lock a message for editing.

        Args:
            chat_id: Unique identifier for the chat.
            message_id: Unique identifier for the message.
            user_id: User ID or fingerprint, depending on the prefix.

        Returns:
            True if message was locked successfully, False otherwise.
        """
        # For now, we'll just return True as locking is not implemented
        return True

    async def update_message_content(
        self,
        message_id: str,
        data: QueryInput,
        user_id: str | None = None,
    ) -> Message:
        """Update the content of a message.

        Args:
            message_id: Unique identifier for the message.
            data: New content for the message.
            user_id: User ID or fingerprint, depending on the prefix.
                Should not be used in this current implementation.

        Returns:
            Updated Message object.
        """
        query = (
            update(ORMMessage)
            .where(ORMMessage.message_id == message_id)
            .values(
                content=self._encrypt(data.text or ""),
                files=self._encrypt(json.dumps(data.images or [])),
                tool_calls=data.tool_calls,
            )
            .returning(ORMMessage)
        )

        result = await self._session.scalar(query)
        if not result:
            raise ValueError(f"Message {message_id} not found")

        raw_files = self._decrypt(result.files) if result.files else "[]"
        return Message(
            id=result.id,
            message_id=result.message_id,
            content=self._decrypt(result.content),
            role=Role(result.role),
            createdAt=result.created_at,
            files=json.loads(raw_files) if raw_files else [],
            tool_calls=json.loads(result.tool_calls) if result.tool_calls else [],
        )

    async def get_next_ai_message(
        self,
        chat_id: str,
        message_id: str,
    ) -> Message:
        """Get the next AI message after the specified message.

        Args:
            chat_id: Unique identifier for the chat.
            message_id: Unique identifier for the current message.

        Returns:
            Next AI Message object.
        """
        query = (
            select(ORMMessage)
            .where(ORMMessage.chat_id == chat_id)
            .where(ORMMessage.role == Role.ASSISTANT)
            .where(
                ORMMessage.created_at
                > (
                    select(ORMMessage.created_at)
                    .where(ORMMessage.message_id == message_id)
                    .scalar_subquery()
                )
            )
            .order_by(ORMMessage.created_at.asc())
            .limit(1)
        )

        result = await self._session.scalar(query)
        if not result:
            raise ValueError(f"No AI message found after {message_id}")

        raw_files = self._decrypt(result.files) if result.files else "[]"
        return Message(
            id=result.id,
            message_id=result.message_id,
            content=self._decrypt(result.content),
            role=Role(result.role),
            createdAt=result.created_at,
            files=json.loads(raw_files) if raw_files else [],
            tool_calls=json.loads(result.tool_calls) if result.tool_calls else [],
        )