from contextlib import AbstractAsyncContextManager
from pathlib import Path
from urllib.parse import unquote

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

# Allowed base directories for SQLite checkpointer databases.
_ALLOWED_BASES = (
    Path.home() / ".attacktrace",
    Path.cwd().resolve(),
)


def _safe_sqlite_path(raw_path: str) -> str:
    """Decode and validate a SQLite file path from a URI.

    Decodes percent-encoded characters, resolves the absolute path, and
    ensures it stays within one of the allowed base directories to prevent
    path-traversal attacks via crafted URIs such as
    ``sqlite:///%2E%2E%2F%2E%2E%2Fetc%2Fpasswd``.
    """
    decoded = unquote(raw_path)
    resolved = Path(decoded).resolve()
    if not any(
        str(resolved).startswith(str(base.resolve()))
        for base in _ALLOWED_BASES
    ):
        raise ValueError(
            f"SQLite checkpointer path '{resolved}' is outside the allowed "
            f"directories: {[str(b) for b in _ALLOWED_BASES]}"
        )
    return str(resolved)


def get_checkpointer(
    uri: str,
) -> AbstractAsyncContextManager[AsyncSqliteSaver | AsyncPostgresSaver]:
    """Get an appropriate async checkpointer based on the database connection string.

    Args:
        uri (str): Database connection string, starting with either 'sqlite' or
        'postgres'

    Raises:
        ValueError: If the database type in the connection string is not supported

    Returns:
        AsyncIterator[BaseCheckpointSaver[V]]: An async checkpointer instance for the
        specified database
    """
    if uri.startswith("sqlite"):
        path = _safe_sqlite_path(uri.removeprefix("sqlite:///"))
        return AsyncSqliteSaver.from_conn_string(path)
    if uri.startswith("postgres"):
        return AsyncPostgresSaver.from_conn_string(uri)
    raise ValueError(f"Unsupported database: {uri}")
