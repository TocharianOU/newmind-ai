"""
Authentication middleware for MCP Host API.
Validates X-Auth-Token header against environment variable.
"""
import hmac
import os
from logging import getLogger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

logger = getLogger(__name__)

# Only /health is publicly accessible. /docs, /openapi.json, /redoc are
# intentionally excluded so API schema is not exposed without authentication.
PUBLIC_ENDPOINTS = [
    "/health",
]


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware to validate authentication token for all API requests."""

    def __init__(self, app: ASGIApp, auth_token: str | None = None):
        """Initialize auth middleware.

        Args:
            app: ASGI application
            auth_token: Expected authentication token (from environment variable)
        """
        super().__init__(app)
        self.auth_token = auth_token or os.getenv("ATTACKTRACE_AUTH_TOKEN")

        if not self.auth_token:
            # In production the token is always injected by Electron. An absent
            # token in a deployed process is a misconfiguration — log critically.
            logger.critical(
                "[Security] ATTACKTRACE_AUTH_TOKEN is not set. "
                "All API requests will be REJECTED to prevent data exposure."
            )
        else:
            # Never log any portion of the token.
            logger.info("[Security] Auth middleware enabled.")

    async def dispatch(self, request: Request, call_next) -> Response:
        """Validate authentication token before processing request."""

        # Allow CORS preflight (OPTIONS only). Do NOT bypass for arbitrary
        # requests that include the Access-Control-Request-Method header —
        # that would allow any request to skip authentication.
        if request.method == "OPTIONS":
            return await call_next(request)

        # Allow the /health endpoint without a token so process monitors work.
        if any(request.url.path.startswith(ep) for ep in PUBLIC_ENDPOINTS):
            return await call_next(request)

        # Reject all requests when no token is configured (fail-closed).
        if not self.auth_token:
            return JSONResponse(
                status_code=503,
                content={
                    "error": "Service Unavailable",
                    "message": "Authentication is not configured on this server."
                }
            )

        # Validate X-Auth-Token header using constant-time comparison.
        provided_token = request.headers.get("X-Auth-Token")

        if not provided_token:
            logger.warning("[Security] Missing X-Auth-Token for %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized", "message": "Missing X-Auth-Token header"}
            )

        if not hmac.compare_digest(provided_token, self.auth_token):
            logger.warning("[Security] Invalid X-Auth-Token for %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=403,
                content={"error": "Forbidden", "message": "Invalid authentication token"}
            )

        return await call_next(request)
