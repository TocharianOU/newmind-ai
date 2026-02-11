"""
Authentication middleware for MCP Host API.
Validates X-Auth-Token header against environment variable.
"""
import os
from logging import getLogger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

logger = getLogger(__name__)

# Public endpoints that don't require authentication
PUBLIC_ENDPOINTS = [
    "/docs",
    "/openapi.json",
    "/redoc",
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
            logger.warning("[Security] Auth token not configured, API will be unprotected!")
        else:
            logger.info(f"[Security] Auth middleware enabled with token: {self.auth_token[:8]}...")

    async def dispatch(self, request: Request, call_next) -> Response:
        """Validate authentication token before processing request."""
        
        # Skip authentication for CORS preflight requests
        # Browsers send OPTIONS + Access-Control-Request-Method before custom-header requests.
        if request.method == "OPTIONS" or request.headers.get("access-control-request-method"):
            return await call_next(request)
        
        # Skip authentication for public endpoints
        if any(request.url.path.startswith(endpoint) for endpoint in PUBLIC_ENDPOINTS):
            return await call_next(request)
        
        # If no auth token configured, allow all requests (dev mode)
        if not self.auth_token:
            return await call_next(request)
        
        # Validate X-Auth-Token header
        provided_token = request.headers.get("X-Auth-Token")
        
        if not provided_token:
            logger.warning(f"[Security] Missing auth token for {request.method} {request.url.path}")
            return JSONResponse(
                status_code=401,
                content={
                    "error": "Unauthorized",
                    "message": "Missing X-Auth-Token header"
                }
            )
        
        if provided_token != self.auth_token:
            logger.warning(f"[Security] Invalid auth token for {request.method} {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Forbidden",
                    "message": "Invalid authentication token"
                }
            )
        
        # Token is valid, proceed with request
        return await call_next(request)
