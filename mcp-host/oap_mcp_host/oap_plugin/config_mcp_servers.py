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

from oap_mcp_host.env import OAP_CONFIG_DIR
from oap_mcp_host.httpd.conf.mcp_servers import (
    Config,
    MCPServerConfig,
    MCPServerManager,
)
from oap_mcp_host.oap_plugin.models import BaseResponse, OAPConfig, UserMcpConfig
from oap_mcp_host.oap_plugin.migration import migrate_to_instance_model

CONFIG_FILE = Path(OAP_CONFIG_DIR, "oap_config.json")
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
        """Update the device token (in-memory only, not persisted to disk).
        
        Security: Token is kept in memory only. It will be lost on process restart,
        which is expected - Electron main process will re-inject via environment variable.
        """
        self.device_token = device_token
        self._http_client.headers = {"Authorization": f"bearer {self.device_token}"}
        # No longer persists to oap_config.json - token stays in memory only
        logger.info("[Security] Device token updated in memory (not persisted to disk)")

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
    """Read the OAP config.
    
    Security: All config now comes from environment variables and defaults.
    File persistence removed to prevent plaintext token leakage.
    - Token: ATTACKTRACE_OAP_TOKEN (injected by Electron at startup)
    - URLs: VITE_API_BASE_URL or HUB_BACKEND_URL (with fallback to localhost:23000)
    """
    # Use environment variables and defaults only - no file persistence
    config = OAPConfig()
    config.auth_key = os.getenv("ATTACKTRACE_OAP_TOKEN")
    
    # Optionally load URL overrides from file if it exists (legacy support)
    if CONFIG_FILE.exists():
        try:
            with CONFIG_FILE.open("r") as f:
                import json
                file_config = json.load(f)
                # Only read non-sensitive config (URLs, SSL settings)
                if "store_url" in file_config:
                    config.store_url = file_config["store_url"]
                if "oap_root_url" in file_config:
                    config.oap_root_url = file_config["oap_root_url"]
                if "verify_ssl" in file_config:
                    config.verify_ssl = file_config["verify_ssl"]
                logger.info("Loaded OAP URL settings from %s", CONFIG_FILE)
        except Exception as e:
            logger.warning("Failed to read OAP config file, using defaults: %s", e)
    
    if config.auth_key:
        logger.info("Using OAP token from environment variable")
    else:
        logger.warning("No OAP token found in ATTACKTRACE_OAP_TOKEN. OAP features will not work.")
    
    return config


def update_oap_token(token: str | None) -> None:
    """Update the OAP token (deprecated - token now comes from environment variable).
    
    Security: This function no longer persists the token to oap_config.json.
    The token is provided via ATTACKTRACE_OAP_TOKEN environment variable at startup.
    Runtime token updates are handled in-memory only via the plugin instance.
    
    This function is kept for backward compatibility but does nothing to prevent
    accidental plaintext token persistence.
    """
    logger.warning(
        "[Security] update_oap_token() called but ignored - "
        "OAP token is now provided via ATTACKTRACE_OAP_TOKEN env var, not persisted to disk"
    )
