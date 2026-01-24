"""MCP Server configuration management in OAP Plugin."""

import logging
import time
from pathlib import Path
from typing import Any, Literal

import httpx
from pydantic import ValidationError

from attacktrace_mcp_host.env import DIVE_CONFIG_DIR
from attacktrace_mcp_host.httpd.conf.mcp_servers import (
    Config,
    MCPServerConfig,
    MCPServerManager,
)
from attacktrace_mcp_host.oap_plugin.models import BaseResponse, OAPConfig, UserMcpConfig

CONFIG_FILE = Path(DIVE_CONFIG_DIR, "oap_config.json")
logger = logging.getLogger("OAP_PLUGIN")

MIN_REFRESH_INTERVAL = 60


class MCPServerManagerPlugin:
    """Manage MCP Server configurations in OAP Plugin."""

    def __init__(self, device_token: str | None, oap_root_url: str) -> None:
        """Initialize the MCPServerConfigs from OAP."""
        self.device_token: str | None = device_token
        self._user_mcp_configs: list[UserMcpConfig] | None = []
        self._refresh_ts: float = 0
        self._http_client = httpx.AsyncClient(
            base_url=oap_root_url,
            headers={"Authorization": f"bearer {self.device_token}"}
            if self.device_token
            else None,
        )

    async def update_device_token(
        self, device_token: str | None, mcp_server_manager: MCPServerManager
    ) -> None:
        """Update the device token and refresh the configs."""
        self.device_token = device_token
        self._http_client.headers = {"Authorization": f"bearer {self.device_token}"}
        update_oap_token(self.device_token)
        await self.refresh(mcp_server_manager)

    async def refresh(self, mcp_server_manager: MCPServerManager) -> None:
        """Refresh the MCP server configs."""
        # Clear local cache first
        self._user_mcp_configs = None
        self._refresh_ts = 0
        logger.info("Cleared local MCP config cache")
        
        # Force refresh from remote
        await self._get_user_mcp_configs(refresh=True)
        cfg = await mcp_server_manager.get_current_config()
        # we already merged the configuration in callback function
        assert cfg is not None
        await mcp_server_manager.update_all_configs(cfg)
        logger.info("MCP server configs refreshed and updated")

    def update_all_config_callback(self, new_config: Config) -> Config:
        """Callback function for updating all configs."""
        return new_config

    async def current_config_callback(self, config: Config) -> Config:
        """Callback function for getting current config."""
        mcp_servers = await self._get_user_mcp_configs()

        # oap id and is enable or not
        mcp_enabled = {}
        for server in config.mcp_servers.values():
            if oap := (server.extra_data or {}).get("oap"):
                mcp_enabled[oap["id"]] = server.enabled

        # remove oap mcp servers
        if mcp_servers is None or len(mcp_servers) > 0:
            for key in config.mcp_servers.copy():
                value = config.mcp_servers[key]
                if value.extra_data and value.extra_data.get("oap"):
                    config.mcp_servers.pop(key)

        if mcp_servers is None:
            return config

        for server in mcp_servers:
            # Build the config based on transport type
            mcp_config = MCPServerConfig(
                enabled=mcp_enabled.get(server.id, True),
                transport=server.transport,
                extraData={
                    "oap": {
                        "id": server.id,
                        "planTag": server.plan.lower(),
                        "description": server.description,
                    }
                },
            )
            
            # Handle stdio transport (command-based)
            if server.transport == "stdio":
                if hasattr(server, 'command') and server.command:
                    mcp_config.command = server.command
                if hasattr(server, 'args') and server.args:
                    mcp_config.args = server.args if isinstance(server.args, list) else []
                if hasattr(server, 'env') and server.env:
                    mcp_config.env = server.env if isinstance(server.env, dict) else {}
            # Handle http/sse/streamable transport (URL-based)
            else:
                mcp_config.url = server.url
                mcp_config.headers = {
                    "Authorization": f"Bearer {self.device_token}",
                    **(server.headers if hasattr(server, 'headers') and server.headers else {}),
                }  # type: ignore
            
            config.mcp_servers[server.name] = mcp_config
        return config

    async def _send_api_request[T](
        self,
        url: str,
        method: Literal["get", "post", "put", "delete"] = "get",
        model: type[T] | Any = Any,
    ) -> tuple[T | None, int]:
        """Send a request to the API and return the response."""
        response = await self._http_client.request(method, url)
        try:
            return (
                BaseResponse[model].model_validate_json(response.text).data,
                response.status_code,
            )
        except ValidationError:
            logger.exception("Failed to validate response: %s", response.text)
            return None, response.status_code

    async def revoke_device_token(self) -> None:
        """Revoke the device token."""
        await self._send_api_request("/api/v1/user/devices/self", "delete")

    async def _get_user_mcp_configs(
        self, refresh: bool = False
    ) -> list[UserMcpConfig] | None:
        """Get the user MCP configs."""
        url = "/api/v1/user/mcp/configs"
        if (
            refresh
            or not self._user_mcp_configs
            or time.time() - self._refresh_ts > MIN_REFRESH_INTERVAL
        ):
            r, code = await self._send_api_request(url, "get", list[UserMcpConfig])
            
            if code == httpx.codes.OK:
                # Success - update configs
                self._refresh_ts = time.time()
                self._user_mcp_configs = r
                logger.info("Successfully fetched %d MCP configs from OAP", len(r) if r else 0)
            elif code in [httpx.codes.UNAUTHORIZED, httpx.codes.FORBIDDEN]:
                # Auth error - don't update configs, keep existing ones
                logger.error("OAP authentication failed (HTTP %d). Please check auth_key in oap_config.json", code)
                if not self._user_mcp_configs:
                    # If no existing configs, return empty list
                    self._user_mcp_configs = []
            else:
                # Other errors - don't update configs
                logger.error("Failed to fetch MCP configs from OAP (HTTP %d)", code)
                if not self._user_mcp_configs:
                    self._user_mcp_configs = []
                    
        return self._user_mcp_configs


def read_oap_config() -> OAPConfig:
    """Read the OAP config."""
    if not CONFIG_FILE.exists():
        logger.warning("OAP config file not found at %s. Creating default config.", CONFIG_FILE)
        config = OAPConfig()
        # Create the config file with default values
        with CONFIG_FILE.open("w") as f:
            f.write(config.model_dump_json(indent=2))
        return config

    try:
        with CONFIG_FILE.open("r") as f:
            config = OAPConfig.model_validate_json(f.read())
            logger.info("Loaded OAP config from %s", CONFIG_FILE)
            if not config.auth_key:
                logger.warning("No auth_key found in OAP config. MCP sync will not work until auth_key is set.")
            return config
    except Exception as e:
        logger.error("Failed to read OAP config from %s: %s", CONFIG_FILE, e)
        return OAPConfig()


def update_oap_token(token: str | None) -> None:
    """Update the OAP token."""
    config = read_oap_config()
    config.auth_key = token
    with CONFIG_FILE.open("w") as f:
        f.write(config.model_dump_json())
