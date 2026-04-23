"""Sync router – export and import chat/message data for cross-device sync.

Data is read from / written into the local SQLite database using the exact
same ORM models as the rest of the application.  The payload format mirrors
the raw database columns so the receiving side can perform a direct upsert.

Each payload is tagged with the originating ``project_id`` (injected by the
Electron main process via ``ATTACKTRACE_PROJECT_ID``).  The Hub must store and
return data scoped by ``(user_id, project_id)`` so that projects remain
isolated across devices.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal

from fastapi import APIRouter, Depends, Query
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from oap_mcp_host.httpd.database.encryption import get_encryption_manager
from oap_mcp_host.httpd.database.orm_models import (
    Chat as ORMChat,
    Message as ORMMessage,
    Users as ORMUsers,
)
from oap_mcp_host.httpd.dependencies import get_app, get_attacktrace_user
from oap_mcp_host.httpd.routers.models import ResultResponse
from oap_mcp_host.httpd.server import AttackTraceHostAPI

if TYPE_CHECKING:
    from oap_mcp_host.httpd.middlewares.general import AttackTraceUser

sync = APIRouter(tags=["sync"])


def _current_project_id() -> str:
    """Return the project ID for this mcp-host process (set once at startup)."""
    return os.environ.get("ATTACKTRACE_PROJECT_ID") or "default"


# ---------------------------------------------------------------------------
# Pydantic payload models – field names match ORM column names exactly
# ---------------------------------------------------------------------------


class SyncChatRecord(BaseModel):
    """One chat row, serialised for transport."""

    id: str
    title: str
    created_at: str
    updated_at: str | None = None
    starred_at: str | None = None


class SyncMessageRecord(BaseModel):
    """One message row, serialised for transport.

    `id` (auto-increment integer PK) is intentionally omitted – it is
    device-local and must not be imported.  `message_id` (UUID TEXT) is the
    globally unique identifier used for deduplication.
    """

    message_id: str = Field(max_length=128)
    chat_id: str = Field(max_length=128)
    content: str = Field(max_length=500_000)
    role: Literal["user", "assistant", "tool", "system"]
    created_at: str = Field(max_length=64)
    files: str = Field(default="[]", max_length=100_000)
    tool_calls: list[Any] | None = None


class SyncPayload(BaseModel):
    """Sync transfer unit scoped to a single (user, project) pair.

    ``project_id`` is set by the exporting device and used by the Hub to keep
    projects isolated across devices.  On import the receiving device ignores
    this field – it always writes into its own currently-active project DB.
    """

    project_id: str = Field(default="default", max_length=128)
    chats: list[SyncChatRecord] = Field(default_factory=list, max_length=10_000)
    messages: list[SyncMessageRecord] = Field(default_factory=list, max_length=100_000)


class SyncExportResult(ResultResponse):
    data: SyncPayload | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _dt_str(value: Any) -> str | None:
    """Convert a datetime (or already-a-string) to ISO-8601 string."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@sync.get("/export", response_model=SyncExportResult)
async def export_sync(
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: "AttackTraceUser" = Depends(get_attacktrace_user),
    since: str | None = Query(
        None,
        description=(
            "ISO-8601 timestamp.  Only chats whose updated_at (or created_at) "
            "is >= this value are returned, along with their messages."
        ),
    ),
) -> SyncExportResult:
    """Export all chats and messages for the authenticated user.

    When `since` is provided only records newer than that timestamp are
    included, enabling efficient incremental sync.
    """
    user_id = dive_user.get("user_id")
    if not user_id:
        return SyncExportResult(success=False, message="Not authenticated", data=None)

    if since:
        try:
            datetime.fromisoformat(since)
        except ValueError:
            return SyncExportResult(
                success=False,
                message="'since' must be a valid ISO-8601 timestamp",
                data=None,
            )

    async with app.db_sessionmaker() as session:
        if since:
            # Incremental export must include:
            # 1) chats updated since `since`
            # 2) chats that have newly-created messages since `since`
            # Without (2), message-only updates can be lost.
            changed_chats = (
                await session.scalars(
                    select(ORMChat).where(
                        ORMChat.user_id == user_id,
                        (ORMChat.updated_at >= since) | (ORMChat.created_at >= since),
                    )
                )
            ).all()

            changed_messages = (
                await session.scalars(
                    select(ORMMessage)
                    .join(ORMChat, ORMMessage.chat_id == ORMChat.id)
                    .where(
                        ORMChat.user_id == user_id,
                        ORMMessage.created_at >= since,
                    )
                )
            ).all()

            chat_ids = {c.id for c in changed_chats} | {
                m.chat_id for m in changed_messages
            }
            if chat_ids:
                orm_chats = (
                    await session.scalars(
                        select(ORMChat).where(
                            ORMChat.user_id == user_id, ORMChat.id.in_(chat_ids)
                        )
                    )
                ).all()
            else:
                orm_chats = []
            orm_messages = changed_messages
        else:
            orm_chats = (
                await session.scalars(
                    select(ORMChat).where(ORMChat.user_id == user_id)
                )
            ).all()
            chat_ids = [c.id for c in orm_chats]
            orm_messages: list[ORMMessage] = []
            if chat_ids:
                orm_messages = (
                    await session.scalars(
                        select(ORMMessage).where(ORMMessage.chat_id.in_(chat_ids))
                    )
                ).all()

    chats = [
        SyncChatRecord(
            id=c.id,
            title=c.title,
            created_at=_dt_str(c.created_at),
            updated_at=_dt_str(c.updated_at),
            starred_at=_dt_str(c.starred_at),
        )
        for c in orm_chats
    ]
    enc = get_encryption_manager(_current_project_id())
    messages = [
        SyncMessageRecord(
            message_id=m.message_id,
            chat_id=m.chat_id,
            content=enc.decrypt(m.content),
            role=m.role,
            created_at=_dt_str(m.created_at),
            files=enc.decrypt(m.files) if m.files else "[]",
            tool_calls=m.tool_calls or [],
        )
        for m in orm_messages
    ]

    return SyncExportResult(
        success=True,
        message="ok",
        data=SyncPayload(
            project_id=_current_project_id(),
            chats=chats,
            messages=messages,
        ),
    )


@sync.post("/import", response_model=ResultResponse)
async def import_sync(
    payload: SyncPayload,
    app: AttackTraceHostAPI = Depends(get_app),
    dive_user: "AttackTraceUser" = Depends(get_attacktrace_user),
) -> ResultResponse:
    """Import chats and messages from a Hub sync payload.

    ``payload.project_id`` is intentionally ignored on import – data is always
    written into the project whose DB this mcp-host process was started with
    (``ATTACKTRACE_PROJECT_ID``).  The Hub is responsible for routing payloads
    to the correct ``(user_id, project_id)`` bucket before returning them here.

    All writes use INSERT OR IGNORE semantics so that:
    - Records that already exist locally are never overwritten (local is
      authoritative for content).
    - New records arriving from other devices are inserted transparently.
    - The operation is fully idempotent.
    """
    user_id = dive_user.get("user_id")
    if not user_id:
        return ResultResponse(success=False, message="Not authenticated")

    chat_count = 0
    msg_count = 0

    async with app.db_sessionmaker() as session:
        # Ensure the user row exists (no-op if already present)
        await session.execute(
            sqlite_insert(ORMUsers)
            .values(id=user_id, user_type=None)
            .on_conflict_do_nothing()
        )

        for c in payload.chats:
            await session.execute(
                sqlite_insert(ORMChat)
                .values(
                    id=c.id,
                    title=c.title,
                    created_at=c.created_at,
                    updated_at=c.updated_at,
                    starred_at=c.starred_at,
                    user_id=user_id,
                )
                .on_conflict_do_nothing()
            )
            chat_count += 1

        enc = get_encryption_manager(_current_project_id())
        for m in payload.messages:
            await session.execute(
                sqlite_insert(ORMMessage)
                .values(
                    message_id=m.message_id,
                    chat_id=m.chat_id,
                    content=enc.encrypt(m.content),
                    role=m.role,
                    created_at=m.created_at,
                    files=enc.encrypt(m.files or "[]"),
                    tool_calls=m.tool_calls or [],
                )
                .on_conflict_do_nothing()
            )
            msg_count += 1

        await session.commit()

    return ResultResponse(
        success=True,
        message=f"Imported {chat_count} chats, {msg_count} messages",
    )
