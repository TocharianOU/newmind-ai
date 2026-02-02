from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
from typing import Optional

from attacktrace_mcp_host.httpd.dependencies import get_app
from attacktrace_mcp_host.httpd.server import AttackTraceHostAPI
from attacktrace_mcp_host.httpd.conf.project_context import (
    get_current_project_id,
    set_current_project_id,
    get_project_config_path
)
from attacktrace_mcp_host.httpd.conf.mcp_servers import MCPServerManager

from .config_mcp_servers import MCPServerManagerPlugin, MCP_PACKAGES_DIR
from .instance_manager import InstanceManager, InstanceRequest
from .package_manager import PackageManager
from .store import OAPStore


class CreateInstanceRequest(BaseModel):
    """Request model for creating an instance"""
    tool_id: str
    tool_name: str
    instance_name: str | None = None
    transport: str = "stdio"
    command: str | None = None
    args: list[str] | None = None
    url: str | None = None
    env: dict[str, str] | None = None
    version: str | None = None
    download_url: str | None = None
    config_schema: dict | None = None
    plan_tag: str = "base"
    description: str = ""
    logo: str | None = None
    banner: str | None = None


class UpdateInstanceRequest(BaseModel):
    """Request model for updating an instance"""
    env: dict[str, str] | None = None
    enabled: bool | None = None


class DownloadPackageRequest(BaseModel):
    """Request model for downloading a package"""
    name: str
    version: str
    download_url: str


class OAPHttpHandlers:
    """OAP Plugin HTTP handlers."""

    def __init__(
        self,
        mcp_server_manager: MCPServerManagerPlugin,
        oap_store: OAPStore,
    ) -> None:
        """Initialize the OAP Plugin."""
        self._mcp_server_manager = mcp_server_manager
        self._oap_store = oap_store
        
        # Initialize PackageManager (global, not project-specific)
        self._package_manager = PackageManager(MCP_PACKAGES_DIR)
        
        self._router = APIRouter(tags=["oap_plugin"])
        
        # Existing routes
        self._router.post("/auth")(self.auth_handler)
        self._router.delete("/auth")(self.logout_handler)
        self._router.post("/config/refresh")(self.refresh_config_handler)
        self._router.post("/config/force-refresh")(self.force_refresh_config_handler)
        
        # New: Package management API
        self._router.get("/packages")(self.list_packages_handler)
        self._router.post("/packages/download")(self.download_package_handler)
        self._router.delete("/packages/{name}/{version}")(self.delete_package_handler)
        
        # New: Instance management API
        self._router.post("/instances")(self.create_instance_handler)
        self._router.get("/instances")(self.list_instances_handler)
        self._router.get("/instances/{instance_name}")(self.get_instance_handler)
        self._router.patch("/instances/{instance_name}")(self.update_instance_handler)
        self._router.delete("/instances/{instance_name}")(self.delete_instance_handler)
    
    def _get_instance_manager(self, project_id: Optional[str] = None) -> InstanceManager:
        """Get or create InstanceManager for the given project"""
        return InstanceManager(
            self._package_manager,
            self._mcp_server_manager.device_token,
            project_id
        )
    
    async def _get_project_config_manager(
        self, project_id: Optional[str] = None
    ) -> MCPServerManager:
        """Get MCPServerManager for the given project"""
        config_path = str(get_project_config_path(project_id))
        manager = MCPServerManager(config_path=config_path, project_id=project_id)
        manager.initialize()
        return manager
    
    async def auth_handler(
        self, token: str, app: AttackTraceHostAPI = Depends(get_app)
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
        self, no_revoke: bool = False, app: AttackTraceHostAPI = Depends(get_app)
    ) -> None:
        """Logout the device."""
        await self._mcp_server_manager.update_device_token(
            None, app.mcp_server_config_manager
        )
        if not no_revoke:
            await self._mcp_server_manager.revoke_device_token()

    async def refresh_config_handler(self, app: AttackTraceHostAPI = Depends(get_app)) -> dict:
        """Refresh the config."""
        try:
            await self._mcp_server_manager.refresh(app.mcp_server_config_manager)
            return {"status": "success", "message": "Configuration refreshed successfully"}
        except Exception as e:
            return {"status": "error", "message": f"Configuration refresh failed: {str(e)}"}

    async def force_refresh_config_handler(self, request: Request, app: AttackTraceHostAPI = Depends(get_app)) -> dict:
        """Force refresh the config, clearing all caches.
        
        Accepts optional JSON body with:
        - instances: List of {id: str, instanceId: str} for creating multiple instances
        """
        try:
            # Parse request body if present
            instances = None
            if request.headers.get("content-type") == "application/json":
                try:
                    body = await request.json()
                    instances = body.get("instances")
                except Exception:
                    pass  # No body or invalid JSON, continue without instances
            
            # Clear local cache
            self._mcp_server_manager._user_mcp_configs = None
            self._mcp_server_manager._refresh_ts = 0
            
            # Force refresh with optional instances
            await self._mcp_server_manager.refresh(app.mcp_server_config_manager, instances=instances)
            return {"status": "success", "message": "Configuration force refreshed successfully", "cache_cleared": True}
        except Exception as e:
            return {"status": "error", "message": f"Configuration force refresh failed: {str(e)}"}
    
    # ===== Package Management API =====
    
    async def list_packages_handler(self):
        """GET /packages - List all downloaded packages"""
        try:
            packages = self._package_manager.list_packages()
            return {
                "status": "success",
                "packages": [
                    {
                        "name": p.name,
                        "version": p.version,
                        "path": str(p.install_path),
                        "package_json": p.package_json,
                    }
                    for p in packages
                ],
            }
        except Exception as e:
            return {"status": "error", "message": f"Failed to list packages: {str(e)}"}
    
    async def download_package_handler(self, request: DownloadPackageRequest):
        """POST /packages/download - Download a package with progress"""
        async def progress_generator():
            try:
                # Check if already exists
                existing_pkg = self._package_manager.get_package(request.name, request.version)
                if existing_pkg:
                    yield f"data: {json.dumps({'status': 'exists', 'progress': 100, 'message': 'Package already downloaded'})}\n\n"
                    yield f"data: {json.dumps({'status': 'success', 'install_path': str(existing_pkg.install_path)})}\n\n"
                    return
                
                # Start download
                yield f"data: {json.dumps({'status': 'downloading', 'progress': 0, 'message': 'Starting download...'})}\n\n"
                
                # Download with progress callback
                progress_queue = asyncio.Queue()
                
                async def progress_callback(progress: int, message: str):
                    await progress_queue.put((progress, message))
                
                # Start download task
                download_task = asyncio.create_task(
                    self._package_manager.download_package_with_progress(
                        request.name, request.version, request.download_url, progress_callback
                    )
                )
                
                # Stream progress updates
                while not download_task.done():
                    try:
                        progress, message = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                        yield f"data: {json.dumps({'status': 'downloading', 'progress': progress, 'message': message})}\n\n"
                    except asyncio.TimeoutError:
                        continue
                
                # Get final result
                pkg = await download_task
                yield f"data: {json.dumps({'status': 'success', 'progress': 100, 'install_path': str(pkg.install_path)})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
        
        return StreamingResponse(progress_generator(), media_type="text/event-stream")
    
    async def delete_package_handler(self, name: str, version: str):
        """DELETE /packages/{name}/{version} - Delete a package"""
        try:
            success = self._package_manager.delete_package(name, version)
            if success:
                return {"status": "success", "message": f"Deleted {name}@{version}"}
            else:
                raise HTTPException(status_code=404, detail=f"Package {name}@{version} not found")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete package: {str(e)}")
    
    # ===== Instance Management API =====
    
    async def create_instance_handler(
        self,
        request: CreateInstanceRequest,
        x_project_id: Optional[str] = Header(None, alias="X-Project-ID"),
        app: AttackTraceHostAPI = Depends(get_app)
    ):
        """POST /instances - Create a new instance"""
        try:
            # Get project-specific config manager
            config_manager = await self._get_project_config_manager(x_project_id)
            config = await config_manager.get_current_config()
            
            # Get project-specific instance manager
            instance_manager = self._get_instance_manager(x_project_id)
            
            instance_request = InstanceRequest(
                tool_id=request.tool_id,
                tool_name=request.tool_name,
                instance_name=request.instance_name,
                transport=request.transport,
                command=request.command,
                args=request.args,
                url=request.url,
                env=request.env or {},
                version=request.version,
                download_url=request.download_url,
                config_schema=request.config_schema,
                plan_tag=request.plan_tag,
                description=request.description,
                logo=request.logo,
                banner=request.banner,
            )
            
            instance_id, instance_name, install_path = await instance_manager.create_instance(
                config, instance_request
            )
            
            await config_manager.update_all_configs(config)
            
            # Get the created instance configuration
            created_config = config.mcp_servers.get(instance_name)
            instance_config = None
            if created_config:
                # Serialize the config to dict for JSON response
                instance_config = created_config.model_dump(by_alias=True)
            
            return {
                "status": "success",
                "instance": {
                    "instance_id": instance_id,
                    "instance_name": instance_name,
                    "install_path": str(install_path) if install_path else None,
                    "config": instance_config,  # Include full configuration
                },
                "full_config": config.model_dump(by_alias=True)  # Return complete config for immediate frontend update
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create instance: {str(e)}")
    
    async def list_instances_handler(
        self,
        x_project_id: Optional[str] = Header(None, alias="X-Project-ID"),
        app: AttackTraceHostAPI = Depends(get_app)
    ):
        """GET /instances - List all instances"""
        try:
            config_manager = await self._get_project_config_manager(x_project_id)
            config = await config_manager.get_current_config()
            instance_manager = self._get_instance_manager(x_project_id)
            instances = instance_manager.list_instances(config)
            return {
                "status": "success",
                "instances": [
                    {
                        "instance_id": i.instance_id,
                        "instance_name": i.instance_name,
                        "tool_id": i.tool_id,
                        "tool_name": i.tool_name,
                        "enabled": i.enabled,
                        "version": i.version,
                    }
                    for i in instances
                ],
            }
        except Exception as e:
            return {"status": "error", "message": f"Failed to list instances: {str(e)}"}
    
    async def get_instance_handler(
        self,
        instance_name: str,
        x_project_id: Optional[str] = Header(None, alias="X-Project-ID"),
        app: AttackTraceHostAPI = Depends(get_app)
    ):
        """GET /instances/{instance_name} - Get single instance information"""
        try:
            config_manager = await self._get_project_config_manager(x_project_id)
            config = await config_manager.get_current_config()
            instance_manager = self._get_instance_manager(x_project_id)
            instance = instance_manager.get_instance(config, instance_name)
            if not instance:
                raise HTTPException(status_code=404, detail=f"Instance {instance_name} not found")
            
            return {
                "status": "success",
                "instance": {
                    "instance_id": instance.instance_id,
                    "instance_name": instance.instance_name,
                    "tool_id": instance.tool_id,
                    "tool_name": instance.tool_name,
                    "enabled": instance.enabled,
                    "version": instance.version,
                    "env": instance.env,
                },
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get instance: {str(e)}")
    
    async def update_instance_handler(
        self,
        instance_name: str,
        request: UpdateInstanceRequest,
        x_project_id: Optional[str] = Header(None, alias="X-Project-ID"),
        app: AttackTraceHostAPI = Depends(get_app),
    ):
        """PATCH /instances/{instance_name} - Update an instance"""
        try:
            config_manager = await self._get_project_config_manager(x_project_id)
            config = await config_manager.get_current_config()
            instance_manager = self._get_instance_manager(x_project_id)
            updates = request.model_dump(exclude_unset=True)
            success = instance_manager.update_instance(config, instance_name, updates)
            if not success:
                raise HTTPException(status_code=404, detail=f"Instance {instance_name} not found")
            
            await config_manager.update_all_configs(config)
            return {"status": "success", "message": f"Updated {instance_name}"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update instance: {str(e)}")
    
    async def delete_instance_handler(
        self,
        instance_name: str,
        x_project_id: Optional[str] = Header(None, alias="X-Project-ID"),
        app: AttackTraceHostAPI = Depends(get_app)
    ):
        """DELETE /instances/{instance_name} - Delete an instance"""
        try:
            config_manager = await self._get_project_config_manager(x_project_id)
            config = await config_manager.get_current_config()
            instance_manager = self._get_instance_manager(x_project_id)
            success = instance_manager.delete_instance(config, instance_name)
            if not success:
                raise HTTPException(status_code=404, detail=f"Instance {instance_name} not found")
            
            await app.mcp_server_config_manager.update_all_configs(config)
            return {"status": "success", "message": f"Deleted {instance_name}"}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete instance: {str(e)}")
    
    def get_router(self) -> APIRouter:
        """Get the router."""
        return self._router
