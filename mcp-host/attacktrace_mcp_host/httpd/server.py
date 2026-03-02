import os
import sys
from collections.abc import AsyncGenerator
from contextlib import AsyncExitStack, asynccontextmanager
from datetime import UTC, datetime
from logging import getLogger
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, FastAPI
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from starlette.middleware.base import BaseHTTPMiddleware

from langgraph.store.memory import InMemoryStore

from attacktrace_mcp_host.host.conf import HostConfig, ServerConfig
from attacktrace_mcp_host.host.conf.llm import LLMConfig
from attacktrace_mcp_host.host.host import AttackTraceMcpHost
from attacktrace_mcp_host.host.store.base import StoreManagerProtocol
from attacktrace_mcp_host.host.store.memory_store import LongTermMemoryStore
from attacktrace_mcp_host.httpd.abort_controller import AbortController
from attacktrace_mcp_host.httpd.conf.command_alias import CommandAliasManager
from attacktrace_mcp_host.httpd.conf.httpd_service import ServiceManager
from attacktrace_mcp_host.httpd.conf.mcp_servers import MCPServerManager
from attacktrace_mcp_host.httpd.conf.models import ModelManager
from attacktrace_mcp_host.httpd.conf.prompt import PromptManager
from attacktrace_mcp_host.httpd.database.migrate import db_migration
from attacktrace_mcp_host.httpd.database.msg_store.base import BaseMessageStore
from attacktrace_mcp_host.httpd.database.msg_store.sqlite import SQLiteMessageStore
from attacktrace_mcp_host.httpd.database.encryption import DatabaseEncryption
from attacktrace_mcp_host.httpd.middlewares.plugins import PluginMiddlewaresManager
from attacktrace_mcp_host.httpd.routers.plugins import RouterPlugin
from attacktrace_mcp_host.httpd.store.cache import LocalFileCache
from attacktrace_mcp_host.httpd.store.manager import StoreManager
from attacktrace_mcp_host.plugins.registry import PluginManager, load_plugins_config

logger = getLogger(__name__)


class Listen(BaseModel):
    """Listen of the AttackTraceHostAPI."""

    ip: str | None = None
    port: int | None = None


class Server(BaseModel):
    """Server of the AttackTraceHostAPI."""

    listen: Listen = Field(default_factory=Listen)


class Status(BaseModel):
    """Status of the AttackTraceHostAPI."""

    state: Literal["UP", "FAILED"]
    last_error: str | None = None
    error_code: str | None = None


class ReportStatus(BaseModel):
    """Report the status of the AttackTraceHostAPI."""

    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    server: Server = Field(default_factory=Server)
    status: Status


class AttackTraceHostAPI(FastAPI):
    """AttackTraceHostAPI is a FastAPI application that is used to host the AttackTraceHost API."""

    attacktrace_host: dict[str, AttackTraceMcpHost]  # should init "default" when prepare stage
    long_term_memory_store: LongTermMemoryStore | None  # long-term memory store

    def __init__(
        self,
        service_config_manager: ServiceManager,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        """Initialize the AttackTraceHostAPI."""
        super().__init__(*args, **kwargs)
        self._service_config_manager = service_config_manager

        self._listen_ip: str | None = None
        self._listen_port: int | None = None
        self._report_status_file: str | None = None
        self._report_status_fd: int | None = None

        self._engine: AsyncEngine | None = None

        self._abort_controller = AbortController()

        if self._service_config_manager.current_setting is None:
            raise ValueError("Service manager is not initialized")

        self._plugin_manager = PluginManager()

        self._mcp_server_config_manager = MCPServerManager(
            self._service_config_manager.current_setting.config_location.mcp_server_config_path
        )
        self._mcp_server_config_manager.register_hook(self._plugin_manager)
        self._model_config_manager = ModelManager(
            self._service_config_manager.current_setting.config_location.model_config_path
        )
        self._prompt_config_manager = PromptManager(
            self._service_config_manager.current_setting.config_location.prompt_config_path
        )
        self._command_alias_config_manager = CommandAliasManager(
            self._service_config_manager.current_setting.config_location.command_alias_config_path
        )

        self._plugin_middlewares_manager = PluginMiddlewaresManager()
        self.add_middleware(
            BaseHTTPMiddleware, dispatch=self._plugin_middlewares_manager.dispatch
        )
        self._plugin_middlewares_manager.register_hook(self._plugin_manager)

        self._plugin_router = APIRouter(tags=["plugins"])
        self._router_plugin = RouterPlugin(self._plugin_router)
        self._router_plugin.register_hook(self._plugin_manager)

        plugins_config = load_plugins_config(
            self._service_config_manager.current_setting.config_location.plugin_config_path
        )
        for plugin_config in plugins_config:
            self._plugin_manager.register_plugin(plugin_config)

        self.include_router(self._plugin_router, prefix="/api/plugins")

    def _load_configs(self) -> None:
        """Load all configs."""
        logger.info("Loading configs")
        self._mcp_server_config_manager.initialize()
        self._model_config_manager.initialize()
        self._prompt_config_manager.initialize()
        self._command_alias_config_manager.initialize()
        logger.info("Configs loaded")

    @asynccontextmanager
    async def prepare(self) -> AsyncGenerator[None, None]:
        """Setup the AttackTraceHostAPI."""
        logger.info("Server Prepare")
        self._load_configs()

        # ================================================
        # Database
        # ================================================
        if self._service_config_manager.current_setting is None:
            raise ValueError("Service manager is not initialized")

        # Database security setup
        db_config = self._service_config_manager.current_setting.db
        db_uri = db_config.uri
        async_db_uri = db_config.async_uri
        
        # Set database file permissions for SQLite (security hardening)
        if db_uri.startswith("sqlite:///"):
            try:
                from pathlib import Path
                import os
                import stat
                
                db_path = db_uri.replace("sqlite:///", "")
                db_file_path = Path(db_path)
                
                # Extract project_id from database path
                project_id = "default"
                if "/projects/" in db_path:
                    parts = db_path.split("/projects/")
                    if len(parts) > 1:
                        project_id = parts[1].split("/")[0]
                
                # Ensure parent directory exists
                db_file_path.parent.mkdir(parents=True, exist_ok=True)
                
                # If database file exists, set restrictive permissions
                if db_file_path.exists():
                    # Unix-like systems: chmod 600 (owner read/write only)
                    if sys.platform != "win32":
                        os.chmod(db_file_path, stat.S_IRUSR | stat.S_IWUSR)
                        logger.info(f"[Database] Set secure permissions (600) for: {db_file_path}")
                
                # Initialize encryption manager for sensitive fields
                if db_config.enable_encryption:
                    db_encryption = DatabaseEncryption(project_id=project_id)
                    db_encryption.get_fernet()  # Initialize encryption key
                    logger.info(f"[Database] Field encryption ready for project: {project_id}")
                
            except Exception as e:
                logger.warning(f"[Database] Failed to set secure permissions: {e}")
                # Continue - not critical for functionality
        
        if db_config.migrate:
            db_migration(uri=db_uri)

        self._engine = create_async_engine(
            async_db_uri,
            echo=db_config.echo,
            # check connection before using
            pool_pre_ping=db_config.pool_pre_ping,
            # max connections
            pool_size=db_config.pool_size,
            # close connection after 60 seconds
            pool_recycle=db_config.pool_recycle,
            # burst connections
            max_overflow=db_config.max_overflow,
        )
        self._db_sessionmaker = async_sessionmaker(self._engine, class_=AsyncSession)
        self._msg_store = SQLiteMessageStore
        
        # Auto-create long_term_memories table if it doesn't exist
        # This avoids migration conflicts
        try:
            from attacktrace_mcp_host.httpd.database.orm_models import Base, LongTermMemory
            async with self._engine.begin() as conn:
                # Only create the LongTermMemory table, don't touch existing tables
                await conn.run_sync(LongTermMemory.__table__.create, checkfirst=True)
            logger.info("Long-term memory table checked/created")
        except Exception as e:
            logger.warning(f"Failed to create long-term memory table: {e}")
            # Non-critical, continue startup

        # ================================================
        # Store
        # ================================================
        self._store = StoreManager(
            root_dir=self._service_config_manager.current_setting.resource_dir
        )
        self._store.register_hook(self._plugin_manager)
        self._local_file_cache = LocalFileCache(
            root_dir=self._service_config_manager.current_setting.resource_dir
        )

        # ================================================
        # AttackTrace Host
        # ================================================
        config = await self.load_host_config()
        async with AsyncExitStack() as stack:
            await stack.enter_async_context(self._plugin_manager)
            await stack.enter_async_context(self._store)
            default_host = AttackTraceMcpHost(config, self._store)
            await stack.enter_async_context(default_host)
            self.attacktrace_host = {"default": default_host}

            # ================================================
            # Long-term Memory Store
            # ================================================
            try:
                # Initialize InMemoryStore for long-term memory
                # We don't pass db_session here, it will be passed per-request in API routes
                memory_store = InMemoryStore()
                self.long_term_memory_store = LongTermMemoryStore(
                    store=memory_store,
                    db_session=None,  # Will be set per-request in API routes
                )
                logger.info("Long-term memory store initialized with InMemoryStore")
            except Exception as e:
                logger.warning(f"Failed to initialize long-term memory store: {e}")
                self.long_term_memory_store = None

            logger.info("Server Prepare Complete")
            yield

    async def load_host_config(
        self,
        mcp_manager: MCPServerManager | None = None,
    ) -> HostConfig:
        """Generate all host configs.

        Args:
            mcp_manager: Optional MCPServerManager to use instead of the global one.
                         Pass this when you want to reload the host with a project-specific
                         config without changing the global manager (e.g. after saving a
                         project-scoped mcpserver config via X-Project-ID).
        """
        model_setting = self._model_config_manager.current_setting
        if model_setting is None:
            model_setting = LLMConfig(
                model_provider="dive",
                model="fake",
            )

        if self._service_config_manager.current_setting is None:
            raise ValueError("MCPServer config manager is not initialized")

        if self._command_alias_config_manager.current_config is None:
            raise ValueError("Command alias config manager is not initialized")

        if self._model_config_manager.full_config is None:
            raise ValueError("Model config manager is not initialized")

        effective_manager = mcp_manager or self._mcp_server_config_manager

        mcp_servers: dict[str, ServerConfig] = {}
        servers = await effective_manager.get_enabled_servers()
        for server_name, server_config in servers.items():
            if not server_config.enabled:
                continue

            # Apply command alias
            if server_config.command:
                command = self._command_alias_config_manager.current_config.get(
                    server_config.command, server_config.command
                )
            else:
                command = ""

            mcp_servers[server_name] = ServerConfig(
                name=server_name,
                command=command,
                args=server_config.args or [],
                env=server_config.env or {},
                enabled=server_config.enabled,
                url=server_config.url or None,
                transport=server_config.transport or "stdio",
                headers=server_config.headers or {},
                proxy=server_config.proxy or None,
                exclude_tools=server_config.exclude_tools,
                initial_timeout=server_config.initial_timeout,
            )

        logger.debug("got %s mcp servers in config", len(mcp_servers))

        return HostConfig(
            llm=model_setting,
            embed=self._model_config_manager.full_config.embed_config,
            checkpointer=self._service_config_manager.current_setting.checkpointer,
            mcp_servers=mcp_servers,
            log_config=self._service_config_manager.current_setting.mcp_server_log,
        )

    async def ready(self) -> bool:
        """Ready the AttackTraceHostAPI."""
        try:
            # check db connection
            async with self._db_sessionmaker() as session:
                await session.execute(text("SELECT 1"))
            return True
        except Exception:
            logger.exception("Server not ready")
            return False

    async def cleanup(self) -> None:
        """Cleanup the AttackTraceHostAPI."""
        logger.info("Server Cleanup")
        if self._engine:
            await self._engine.dispose()
        logger.info("Server Cleanup Complete")

    def set_status_report_info(
        self,
        listen: str,
        report_status_file: str | None = None,
        report_status_fd: int | None = None,
    ) -> None:
        """Set the status report info."""
        self._listen_ip = listen
        self._report_status_file = report_status_file
        self._report_status_fd = report_status_fd

    def set_listen_port(self, port: int) -> None:
        """Set the listen port."""
        self._listen_port = port

    def report_status(self, error: str | None = None) -> None:
        """Report the status of the AttackTraceHostAPI."""
        if error:
            msg = ReportStatus(
                status=Status(state="FAILED", last_error=error),
            )

        elif self._listen_ip and self._listen_port:
            msg = ReportStatus(
                server=Server(
                    listen=Listen(ip=self._listen_ip, port=self._listen_port)
                ),
                status=Status(state="UP"),
            )
        else:
            raise ValueError("Status info not complete")

        if self._report_status_file:
            logger.info("Report status to file: %s", self._report_status_file)
            with Path(self._report_status_file).open("w") as f:
                f.write(msg.model_dump_json())

        elif self._report_status_fd:
            logger.info("Report status to fd: %s", self._report_status_fd)
            os.write(
                self._report_status_fd,
                f"{msg.model_dump_json()}\r\n".encode(),
            )
        else:
            logger.info("No fd or file to report status")

    @property
    def db_sessionmaker(self) -> async_sessionmaker[AsyncSession]:
        """Get the database sessionmaker."""
        return self._db_sessionmaker

    @property
    def msg_store(self) -> type[BaseMessageStore]:
        """Get message store type."""
        return self._msg_store

    @property
    def store(self) -> StoreManagerProtocol:
        """Get the store."""
        return self._store

    @property
    def local_file_cache(self) -> LocalFileCache:
        """Get the local file cache."""
        return self._local_file_cache

    @property
    def service_manager(self) -> ServiceManager:
        """Get the service manager."""
        return self._service_config_manager

    @property
    def mcp_server_config_manager(self) -> MCPServerManager:
        """Get the MCP server config manager."""
        return self._mcp_server_config_manager

    @property
    def model_config_manager(self) -> ModelManager:
        """Get the model config manager."""
        return self._model_config_manager

    @property
    def prompt_config_manager(self) -> PromptManager:
        """Get the prompt config manager."""
        return self._prompt_config_manager

    @property
    def abort_controller(self) -> AbortController:
        """Get the abort controller."""
        return self._abort_controller
