"""Dependencies for the MCP host."""

from typing import TYPE_CHECKING, AsyncGenerator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from oap_mcp_host.httpd.middlewares.general import AttackTraceUser
    from oap_mcp_host.httpd.server import AttackTraceHostAPI


def get_app(request: Request) -> "AttackTraceHostAPI":
    """Get the AttackTraceHostAPI instance."""
    return request.app


def get_attacktrace_user(
    request: Request,
) -> "AttackTraceUser":
    """Get the AttackTraceUser instance."""
    return request.state.dive_user


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Get a database session for the request.
    
    Yields:
        AsyncSession instance.
    """
    app: "AttackTraceHostAPI" = request.app
    async with app._db_sessionmaker() as session:
        yield session
