"""Instance Manager - Manages MCP instance creation, deletion, and updates"""
import logging
import uuid
from dataclasses import dataclass
from pathlib import Path

from attacktrace_mcp_host.httpd.conf.mcp_servers import Config, MCPServerConfig

from .package_manager import PackageManager

logger = logging.getLogger("InstanceManager")


@dataclass
class InstanceRequest:
    """Request parameters for creating an instance"""
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


@dataclass
class InstanceInfo:
    """Instance information"""
    instance_id: str
    instance_name: str
    tool_id: str
    tool_name: str
    enabled: bool
    env: dict[str, str] | None
    version: str | None


class InstanceManager:
    """Manages CRUD operations for instances"""
    
    def __init__(self, package_manager: PackageManager, device_token: str | None, project_id: str | None = None):
        self.package_manager = package_manager
        self.device_token = device_token
        self.project_id = project_id  # Project context
        logger.info(f"InstanceManager initialized for project: {project_id or 'default'}")
    
    def _generate_unique_name(self, config: Config, base_name: str) -> str:
        """Generate unique instance name with auto-incrementing suffix
        
        If base_name doesn't exist, return it directly
        Otherwise try base_name_2, base_name_3, ... until finding a non-conflicting name
        """
        if base_name not in config.mcp_servers:
            return base_name
        
        counter = 2
        while f"{base_name}_{counter}" in config.mcp_servers:
            counter += 1
        
        return f"{base_name}_{counter}"
    
    async def create_instance(
        self, config: Config, request: InstanceRequest
    ) -> tuple[str, str, Path | None]:
        """创建新实例
        
        Returns:
            (instance_id, instance_name, install_path)
        """
        instance_id = str(uuid.uuid4())
        logger.info(f"Creating instance for tool {request.tool_name} (id: {request.tool_id})")
        
        # Download package (if needed)
        install_path = None
        if request.download_url and request.version:
            try:
                pkg = await self.package_manager.download_package(
                    request.tool_name, request.version, request.download_url
                )
                install_path = pkg.install_path
                logger.info(f"Package installed at {install_path}")
            except Exception as e:
                logger.error(f"Failed to download package: {e}")
                # Continue creating instance without install_path
        
        # Generate instance name with conflict detection
        if request.instance_name:
            # User provided a name - check if it conflicts with existing instances
            if request.instance_name in config.mcp_servers:
                # Name conflict - auto-generate unique name based on provided name
                instance_name = self._generate_unique_name(config, request.instance_name)
                logger.info(f"Name conflict detected for '{request.instance_name}', using unique name: {instance_name}")
            else:
                # No conflict - use provided name
                instance_name = request.instance_name
        else:
            # No name provided - generate unique name based on tool name
            instance_name = self._generate_unique_name(config, request.tool_name)
        
        logger.info(f"Generated instance name: {instance_name}")
        
        # Prepare configuration parameters
        config_params = {
            "enabled": True,  # New instances default to enabled
            "transport": request.transport,
            "version": request.version,
            "configSchema": request.config_schema,
            "extraData": {
                "oap": {
                    "id": request.tool_id,
                    "instanceId": instance_id,
                    "name": request.tool_name,
                    "planTag": request.plan_tag,
                    "description": request.description,
                    "version": request.version,
                    "downloadUrl": request.download_url,
                    "configSchema": request.config_schema,
                    "logo": request.logo,
                    "banner": request.banner,
                    "installPath": str(install_path) if install_path else None,
                }
            },
        }
        
        # Handle stdio transport
        if request.transport == "stdio":
            if request.command:
                config_params["command"] = request.command
            
            if request.args and install_path:
                # Replace {{install_path}} placeholder
                config_params["args"] = [
                    arg.replace("{{install_path}}", str(install_path))
                    for arg in request.args
                ]
            elif request.args:
                config_params["args"] = request.args
            
            if request.env:
                config_params["env"] = request.env
        else:
            # Handle http/sse/streamable transport
            config_params["url"] = request.url
            config_params["headers"] = {
                "Authorization": f"Bearer {self.device_token}",
            }
        
        # Write configuration
        mcp_config = MCPServerConfig(**config_params)
        config.mcp_servers[instance_name] = mcp_config
        
        logger.info(f"Instance {instance_name} created successfully with ID {instance_id}")
        return instance_id, instance_name, install_path
    
    def delete_instance(self, config: Config, instance_name: str) -> bool:
        """Delete instance (does not delete package)"""
        if instance_name in config.mcp_servers:
            del config.mcp_servers[instance_name]
            logger.info(f"Instance {instance_name} deleted")
            return True
        else:
            logger.warning(f"Instance {instance_name} not found")
            return False
    
    def update_instance(
        self, config: Config, instance_name: str, updates: dict
    ) -> bool:
        """Update instance configuration
        
        Supported fields:
        - env: dict[str, str] - Environment variables (merged with existing env)
        - enabled: bool - Enable/disable status
        """
        if instance_name not in config.mcp_servers:
            logger.warning(f"Instance {instance_name} not found")
            return False
        
        server = config.mcp_servers[instance_name]
        
        # Update allowed fields
        if "env" in updates:
            if server.env is None:
                server.env = {}
            server.env.update(updates["env"])
            logger.info(f"Updated env for instance {instance_name}")
        
        if "enabled" in updates:
            server.enabled = updates["enabled"]
            logger.info(f"Set enabled={updates['enabled']} for instance {instance_name}")
        
        return True
    
    def list_instances(self, config: Config) -> list[InstanceInfo]:
        """List all OAP instances (excluding custom MCPs)"""
        instances = []
        for name, server in config.mcp_servers.items():
            if not server.extra_data or "oap" not in server.extra_data:
                continue
            
            oap = server.extra_data["oap"]
            instances.append(InstanceInfo(
                instance_id=oap.get("instanceId", oap["id"]),  # Fallback to oap.id (backward compatibility)
                instance_name=name,
                tool_id=oap["id"],
                tool_name=oap["name"],
                enabled=server.enabled,
                env=server.env,
                version=oap.get("version"),
            ))
        
        return instances
    
    def get_instance(self, config: Config, instance_name: str) -> InstanceInfo | None:
        """Get single instance information"""
        if instance_name not in config.mcp_servers:
            return None
        
        server = config.mcp_servers[instance_name]
        if not server.extra_data or "oap" not in server.extra_data:
            return None
        
        oap = server.extra_data["oap"]
        return InstanceInfo(
            instance_id=oap.get("instanceId", oap["id"]),
            instance_name=instance_name,
            tool_id=oap["id"],
            tool_name=oap["name"],
            enabled=server.enabled,
            env=server.env,
            version=oap.get("version"),
        )
