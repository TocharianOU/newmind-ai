from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from logging import getLogger

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from attacktrace_mcp_host.httpd.conf.httpd_service import ServiceManager
from attacktrace_mcp_host.httpd.middlewares import default_state, error_handler, AuthMiddleware
from fastapi.responses import JSONResponse

from attacktrace_mcp_host.httpd.routers.chat import chat
from attacktrace_mcp_host.httpd.routers.config import config
from attacktrace_mcp_host.httpd.routers.memory import router as memory_router
from attacktrace_mcp_host.httpd.routers.model_verify import model_verify
from attacktrace_mcp_host.httpd.routers.openai import openai
from attacktrace_mcp_host.httpd.routers.sync import sync
from attacktrace_mcp_host.httpd.routers.tools import tools
from attacktrace_mcp_host.httpd.server import AttackTraceHostAPI

logger = getLogger(__name__)


@asynccontextmanager
async def lifespan(app: AttackTraceHostAPI) -> AsyncGenerator[None, None]:
    """Lifespan for the FastAPI app."""
    try:
        async with app.prepare():
            app.report_status()
            yield
    except Exception as e:
        logger.exception("Error in lifespan")
        app.report_status(error=str(e))
        yield
    finally:
        await app.cleanup()


def create_app(
    service_config_manager: ServiceManager,
) -> AttackTraceHostAPI:
    """Create the FastAPI app."""
    app = AttackTraceHostAPI(
        lifespan=lifespan,
        service_config_manager=service_config_manager,
    )
    app.add_exception_handler(Exception, error_handler)

    service_setting = service_config_manager.current_setting
    cors_origin = (
        service_setting.cors_origin
        if service_setting and service_setting.cors_origin
        else "http://localhost"
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[cors_origin],
        # NOTE: wildcard origin + credentials is invalid for CORS preflight in browsers
        allow_credentials=(cors_origin != "*"),
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        # Requests may include cache-control headers and future custom headers.
        # Using wildcard avoids fragile preflight failures.
        allow_headers=["*"],
    )

    # Security: add auth after CORS so browser preflight can succeed
    app.add_middleware(AuthMiddleware)
    logger.info("[Security] Authentication middleware enabled")
    app.add_middleware(BaseHTTPMiddleware, dispatch=default_state)
    app.include_router(openai, prefix="/v1/openai")
    app.include_router(chat, prefix="/api/chat")
    app.include_router(tools, prefix="/api/tools")
    app.include_router(config, prefix="/api/config")
    app.include_router(model_verify, prefix="/model_verify")
    app.include_router(memory_router)  # Memory management routes
    app.include_router(sync, prefix="/api/sync")

    @app.get("/health")
    async def health() -> JSONResponse:
        """Liveness probe — auth middleware already allows this path through."""
        return JSONResponse({"status": "ok"})

    return app
