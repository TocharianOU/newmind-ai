"""Data migration script - Add instanceId to old instances"""
import logging
import uuid

from attacktrace_mcp_host.httpd.conf.mcp_servers import Config

logger = logging.getLogger("OAPMigration")


def migrate_to_instance_model(config: Config) -> bool:
    """Add instanceId to old OAP instances
    
    Args:
        config: MCP configuration object
    
    Returns:
        True if migration was performed, False if nothing needed migration
    """
    migrated = False
    
    for name, server in config.mcp_servers.items():
        if not server.extra_data or "oap" not in server.extra_data:
            continue
        
        oap = server.extra_data["oap"]
        
        # Skip if instanceId already exists
        if "instanceId" in oap and oap["instanceId"]:
            continue
        
        # Generate new instanceId
        oap["instanceId"] = str(uuid.uuid4())
        migrated = True
        logger.info(f"Migrated instance {name} with new instanceId: {oap['instanceId']}")
    
    if migrated:
        logger.info("Migration completed: added instanceId to old OAP instances")
    else:
        logger.debug("No migration needed: all instances already have instanceId")
    
    return migrated
