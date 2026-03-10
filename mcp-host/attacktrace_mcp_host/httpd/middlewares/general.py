import os
from collections.abc import Callable
from typing import TypedDict

from fastapi import Request
from fastapi.responses import JSONResponse, Response

from attacktrace_mcp_host.httpd.routers.models import ResultResponse, UserInputError


async def error_handler(_: Request, exc: Exception) -> Response:
    """Error handling middleware.

    Args:
        request (Request): The request object.
        exc (Exception): The exception to handle.

    Returns:
        ResultResponse: The response object.
    """
    msg = ResultResponse(success=False, message=str(exc)).model_dump(
        mode="json",
        by_alias=True,
    )

    if isinstance(exc, UserInputError):
        return JSONResponse(
            status_code=400,
            content=msg,
        )

    return JSONResponse(
        status_code=500,
        content=msg,
    )


class AttackTraceUser(TypedDict):
    """User-related state storage.

    This state can be accessed by all middlewares and handlers.
    """

    user_id: str | None
    user_name: str | None
    user_type: str | None
    token_spent: int
    """The amount of tokens spent by the user in this period."""
    token_limit: int
    """The amount of tokens the user can use in this period."""
    token_increased: int
    """The amount of tokens increased in this request."""


async def default_state(request: Request, call_next: Callable) -> Response:
    """Prefill default state.

    user_id is read from the ATTACKTRACE_USER_ID environment variable which is
    injected by the Electron main process after decoding the OAP JWT token.
    This value is stable for the lifetime of the mcp-host process; the host is
    restarted by the Electron main process whenever the logged-in user changes.
    """
    user_id: str | None = os.environ.get("ATTACKTRACE_USER_ID") or None
    request.state.dive_user = AttackTraceUser(
        user_id=user_id,
        user_name=None,
        user_type=None,
        token_spent=0,
        token_limit=0,
        token_increased=0,
    )
    return await call_next(request)
