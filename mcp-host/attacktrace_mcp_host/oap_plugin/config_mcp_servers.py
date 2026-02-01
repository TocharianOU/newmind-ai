"""MCP Server configuration management in OAP Plugin."""

import logging
import time
import os
import subprocess
import tarfile
import tempfile
import uuid
from pathlib import Path
from typing import Any, Literal

import httpx
from pydantic import ValidationError

from attacktrace_mcp_host.env import ATTACKTRACE_CONFIG_DIR
from attacktrace_mcp_host.httpd.conf.mcp_servers import (
    Config,
    MCPServerConfig,
    MCPServerManager,
)
from attacktrace_mcp_host.oap_plugin.models import BaseResponse, OAPConfig, UserMcpConfig
from attacktrace_mcp_host.oap_plugin.migration import migrate_to_instance_model

CONFIG_FILE = Path(ATTACKTRACE_CONFIG_DIR, "oap_config.json")
logger = logging.getLogger("OAP_PLUGIN")

MIN_REFRESH_INTERVAL = 60
RATE_LIMIT_BACKOFF = 300  # 5 minutes backoff for 429 errors

# MCP packages installation directory
MCP_PACKAGES_DIR = Path.home() / ".attacktrace" / "mcp-packages"


class MCPServerManagerPlugin:
    """Manage MCP Server configurations in OAP Plugin."""

    def __init__(self, device_token: str | None, oap_root_url: str) -> None:
        """Initialize the MCPServerConfigs from OAP."""
        self.device_token: str | None = device_token
        self._user_mcp_configs: list[UserMcpConfig] | None = []
        self._refresh_ts: float = 0
        self._rate_limit_until: float = 0  # Track when rate limit will be lifted
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

    async def refresh(self, mcp_server_manager: MCPServerManager, instances: list[dict] | None = None) -> None:
        """Refresh the MCP server configs.
        
        Args:
            mcp_server_manager: The MCP server manager
            instances: Optional list of {id: str, instanceId: str} for creating multiple instances
        """
        # Clear local cache first
        self._user_mcp_configs = None
        self._refresh_ts = 0
        logger.info("Cleared local MCP config cache")
        
        # Force refresh from remote
        mcp_servers = await self._get_user_mcp_configs(refresh=True)
        
        # If instances provided, duplicate servers for multi-instance support
        if instances and mcp_servers:
            instance_map = {}  # instanceId -> toolId
            for inst in instances:
                instance_map[inst["instanceId"]] = inst["id"]
            
            # Create server entries for each instance
            expanded_servers = []
            for server in mcp_servers:
                matching_instances = [
                    inst_id for inst_id, tool_id in instance_map.items()
                    if tool_id == server.id
                ]
                
                if matching_instances:
                    # Create a server entry for each instance
                    for inst_id in matching_instances:
                        from copy import deepcopy
                        server_copy = deepcopy(server)
                        server_copy.instanceId = inst_id
                        expanded_servers.append(server_copy)
                else:
                    # Keep original server if no instance info
                    expanded_servers.append(server)
            
            self._user_mcp_configs = expanded_servers
        
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
        # Run migration (add instanceId to existing OAP instances)
        try:
            migration_result = migrate_to_instance_model(config)
            if migration_result:
                logger.info("Applied migration: added instanceId to existing OAP instances")
        except Exception as e:
            logger.error(f"Migration failed: {e}")
        
        # Return config immediately without fetching from OAP or modifying config.mcp_servers
        # This prevents overwriting local instance deletions/changes with stale data from OAP backend
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
    
    async def _ensure_package_installed(
        self, name: str, version: str, download_url: str
    ) -> Path:
        """Ensure MCP package is installed, download if necessary."""
        # Create packages directory if not exists
        MCP_PACKAGES_DIR.mkdir(parents=True, exist_ok=True)
        
        # Check if already installed
        install_dir = MCP_PACKAGES_DIR / f"{name}@{version}"
        package_json = install_dir / "package.json"
        
        if package_json.exists():
            logger.debug(f"Package {name}@{version} already installed at {install_dir}")
            return install_dir
        
        # Download and extract
        logger.info(f"Downloading {name}@{version} from {download_url}...")
        
        with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            
            try:
                # Download file
                async with httpx.AsyncClient(follow_redirects=True) as client:
                    async with client.stream('GET', download_url) as response:
                        response.raise_for_status()
                        
                        with open(temp_path, 'wb') as f:
                            async for chunk in response.aiter_bytes():
                                f.write(chunk)
                
                logger.info(f"Downloaded {name}@{version} to {temp_path}")
                
                # Extract tar.gz
                logger.info(f"Extracting to {install_dir}...")
                install_dir.mkdir(parents=True, exist_ok=True)
                
                with tarfile.open(temp_path, 'r:gz') as tar_ref:
                    tar_ref.extractall(install_dir)
                
                logger.info(f"✓ Extracted {name}@{version} successfully")
                
                # Validate installation
                if not package_json.exists():
                    raise FileNotFoundError(f"Invalid package: missing package.json at {package_json}")
                
                logger.info(f"✅ {name}@{version} installed successfully at {install_dir}")
                
                return install_dir
                
            finally:
                # Clean up temp file
                if temp_path.exists():
                    temp_path.unlink()
                    
        return install_dir

    async def _get_user_mcp_configs(
        self, refresh: bool = False
    ) -> list[UserMcpConfig] | None:
        """Get the user MCP configs."""
        url = "/api/v1/user/mcp/configs"
        current_time = time.time()
        
        # Check if we're still in rate limit backoff period
        if current_time < self._rate_limit_until:
            remaining = int(self._rate_limit_until - current_time)
            logger.debug("Rate limited, skipping request. Retry in %d seconds", remaining)
            return self._user_mcp_configs or []
        
        if (
            refresh
            or not self._user_mcp_configs
            or current_time - self._refresh_ts > MIN_REFRESH_INTERVAL
        ):
            r, code = await self._send_api_request(url, "get", list[UserMcpConfig])
            
            if code == httpx.codes.OK:
                # Success - update configs and clear rate limit
                self._refresh_ts = current_time
                self._user_mcp_configs = r
                self._rate_limit_until = 0  # Clear any rate limit
                logger.info("Successfully fetched %d MCP configs from OAP", len(r) if r else 0)
            elif code == httpx.codes.TOO_MANY_REQUESTS:
                # Rate limited - back off for longer period
                self._rate_limit_until = current_time + RATE_LIMIT_BACKOFF
                logger.warning(
                    "Rate limited by OAP (HTTP 429). Backing off for %d seconds. "
                    "Consider increasing MIN_REFRESH_INTERVAL or disabling OAP sync.",
                    RATE_LIMIT_BACKOFF
                )
                if not self._user_mcp_configs:
                    self._user_mcp_configs = []
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
