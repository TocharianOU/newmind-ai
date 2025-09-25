from fastapi import APIRouter, Depends

from dive_mcp_host.httpd.dependencies import get_app
from dive_mcp_host.httpd.server import DiveHostAPI

from .config_mcp_servers import MCPServerManagerPlugin
from .store import OAPStore


class OAPHttpHandlers:
    """OAP Plugin."""

    def __init__(
        self,
        mcp_server_manager: MCPServerManagerPlugin,
        oap_store: OAPStore,
    ) -> None:
        """Initialize the OAP Plugin."""
        self._mcp_server_manager = mcp_server_manager
        self._oap_store = oap_store
        self._router = APIRouter(tags=["oap_plugin"])
        self._router.post("/auth")(self.auth_handler)
        self._router.delete("/auth")(self.logout_handler)
        self._router.post("/config/refresh")(self.refresh_config_handler)
        self._router.post("/config/force-refresh")(self.force_refresh_config_handler)

    async def auth_handler(
        self, token: str, app: DiveHostAPI = Depends(get_app)
    ) -> dict:
        """Update the device token."""
        try:
            await self._mcp_server_manager.update_device_token(
                token, app.mcp_server_config_manager
            )
            self._oap_store.update_token(token)
            return {"status": "success", "message": "Authentication updated successfully"}
        except Exception as e:
            return {"status": "error", "message": f"Authentication failed: {str(e)}"}

    async def logout_handler(
        self, no_revoke: bool = False, app: DiveHostAPI = Depends(get_app)
    ) -> None:
        """Logout the device."""
        await self._mcp_server_manager.update_device_token(
            None, app.mcp_server_config_manager
        )
        if not no_revoke:
            await self._mcp_server_manager.revoke_device_token()

    async def refresh_config_handler(self, app: DiveHostAPI = Depends(get_app)) -> dict:
        """Refresh the config."""
        try:
            await self._mcp_server_manager.refresh(app.mcp_server_config_manager)
            return {"status": "success", "message": "Configuration refreshed successfully"}
        except Exception as e:
            return {"status": "error", "message": f"Configuration refresh failed: {str(e)}"}

    async def force_refresh_config_handler(self, app: DiveHostAPI = Depends(get_app)) -> dict:
        """Force refresh the config, clearing all caches."""
        try:
            # Clear local cache
            self._mcp_server_manager._user_mcp_configs = None
            self._mcp_server_manager._refresh_ts = 0
            
            # Force refresh
            await self._mcp_server_manager.refresh(app.mcp_server_config_manager)
            return {"status": "success", "message": "Configuration force refreshed successfully", "cache_cleared": True}
        except Exception as e:
            return {"status": "error", "message": f"Configuration force refresh failed: {str(e)}"}

    def get_router(self) -> APIRouter:
        """Get the router."""
        return self._router
