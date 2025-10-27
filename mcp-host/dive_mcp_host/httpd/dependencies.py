"""Dependencies for the MCP host."""

from typing import TYPE_CHECKING, AsyncGenerator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from dive_mcp_host.httpd.middlewares.general import DiveUser
    from dive_mcp_host.httpd.server import DiveHostAPI


def get_app(request: Request) -> "DiveHostAPI":
    """Get the DiveHostAPI instance."""
    return request.app


def get_dive_user(
    request: Request,
) -> "DiveUser":
    """Get the DiveUser instance."""
    return request.state.dive_user


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Get a database session for the request.
    
    Yields:
        AsyncSession instance.
    """
    app: "DiveHostAPI" = request.app
    async with app._db_sessionmaker() as session:
        yield session
