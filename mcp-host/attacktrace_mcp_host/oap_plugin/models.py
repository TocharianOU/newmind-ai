import os
from typing import Literal

from pydantic import BaseModel


class OAPConfig(BaseModel):
    """OAP Config."""

    auth_key: str | None = None
    # 使用环境变量 HUB_BACKEND_URL，默认指向 NewmindHub 后端
    store_url: str = os.getenv("HUB_BACKEND_URL", "http://xiaopenges.tocharian.eu:23000")
    oap_root_url: str = os.getenv("HUB_BACKEND_URL", "http://xiaopenges.tocharian.eu:23000")
    verify_ssl: bool = False


# /api/v1/user/mcp/configs
class UserMcpConfig(BaseModel):
    """User MCP Config."""

    id: str
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
