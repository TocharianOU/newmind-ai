from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from logging import getLogger

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from dive_mcp_host.httpd.conf.httpd_service import ServiceManager
from dive_mcp_host.httpd.middlewares import default_state, error_handler
from dive_mcp_host.httpd.routers.chat import chat
from dive_mcp_host.httpd.routers.config import config
from dive_mcp_host.httpd.routers.memory import router as memory_router
from dive_mcp_host.httpd.routers.model_verify import model_verify
from dive_mcp_host.httpd.routers.openai import openai
from dive_mcp_host.httpd.routers.tools import tools
from dive_mcp_host.httpd.server import DiveHostAPI

logger = getLogger(__name__)


@asynccontextmanager
async def lifespan(app: DiveHostAPI) -> AsyncGenerator[None, None]:
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
) -> DiveHostAPI:
    """Create the FastAPI app."""
    app = DiveHostAPI(
        lifespan=lifespan,
        service_config_manager=service_config_manager,
    )
    app.add_exception_handler(Exception, error_handler)

    service_setting = service_config_manager.current_setting
    # Configure CORS - allow specific origin or default to localhost for development
    cors_origins = []
    if service_setting and service_setting.cors_origin:
        cors_origins = [service_setting.cors_origin]
    else:
        # Default: allow common local development origins
        cors_origins = [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=[
            "Origin",
            "X-Requested-With",
            "Content-Type",
            "Accept",
            "Authorization",
        ],
    )
    app.add_middleware(BaseHTTPMiddleware, dispatch=default_state)
    app.include_router(openai, prefix="/v1/openai")
    app.include_router(chat, prefix="/api/chat")
    app.include_router(tools, prefix="/api/tools")
    app.include_router(config, prefix="/api/config")
    app.include_router(model_verify, prefix="/model_verify")
    app.include_router(memory_router)  # Memory management routes

    # remote endpoints
    app.include_router(chat, prefix="/api/v1/mcp")

    return app
