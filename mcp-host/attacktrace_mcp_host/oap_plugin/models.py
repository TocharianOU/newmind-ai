import os
from typing import Literal

from pydantic import BaseModel


class OAPConfig(BaseModel):
    """OAP Config."""

    auth_key: str | None = None
    # Use environment variable VITE_API_BASE_URL or HUB_BACKEND_URL, defaults to localhost
    store_url: str = os.getenv("VITE_API_BASE_URL") or os.getenv("HUB_BACKEND_URL", "http://localhost:23000")
    oap_root_url: str = os.getenv("VITE_API_BASE_URL") or os.getenv("HUB_BACKEND_URL", "http://localhost:23000")
    verify_ssl: bool = False


# /api/v1/user/mcp/configs
class UserMcpConfig(BaseModel):
    """User MCP Config."""

    id: str
    instanceId: str | None = None
    name: str
    description: str | None = None
    transport: Literal["stdio", "sse", "streamable", "http"]
    command: str | None = None
    args: list[str] | None = None
    url: str | None = None
    env: dict[str, str] | None = None
    headers: dict[str, str] | None = None
    plan: str
    banner: str | None = None
    document: str | None = None
    version: str | None = None
    downloadUrl: str | None = None
    configSchema: dict | None = None
    token_cost: float | None = None
    token_required: float | None = None
    token_price_unit: str | None = None
    popular: bool | None = None
    new: bool | None = None


class BaseResponse[T](BaseModel):
    """Base Response."""

    status: Literal["success", "error"]
    error: str | None = None
    data: T | None = None


class TokenNotSetError(Exception):
    """Token not set error."""

    message: str = "Token is not set"

    def __str__(self) -> str:
        """Return the error message."""
        return self.message
