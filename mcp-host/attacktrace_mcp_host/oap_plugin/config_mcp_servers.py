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
    """Manage MCP Server package downloads and installations.
    
    Note: Tool configuration is now fully local. This plugin only handles:
    - Package downloads from tool marketplace
    - Device token management for authentication
    - No cloud synchronization of tool configurations
    """

    def __init__(self, device_token: str | None, oap_root_url: str) -> None:
        """Initialize the MCPServerManagerPlugin."""
        self.device_token: str | None = device_token
        self._http_client = httpx.AsyncClient(
            base_url=oap_root_url,
            headers={"Authorization": f"bearer {self.device_token}"}
            if self.device_token
            else None,
        )

    async def update_device_token(
        self, device_token: str | None, mcp_server_manager: MCPServerManager
    ) -> None:
        """Update the device token (no longer triggers config refresh)."""
        self.device_token = device_token
        self._http_client.headers = {"Authorization": f"bearer {self.device_token}"}
        update_oap_token(self.device_token)
        # No longer refreshes tool configs from cloud - configs are fully local
        logger.info("Device token updated. Tool configurations remain local.")

    async def refresh(self, mcp_server_manager: MCPServerManager, instances: list[dict] | None = None) -> None:
        """Refresh method - now a no-op since configs are fully local.
        
        Kept for backward compatibility but does nothing.
        Tool configurations are managed locally via instance APIs.
        
        Args:
            mcp_server_manager: The MCP server manager (unused)
            instances: Optional list (unused)
        """
        logger.info("Refresh called but skipped - tool configurations are fully local")

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
