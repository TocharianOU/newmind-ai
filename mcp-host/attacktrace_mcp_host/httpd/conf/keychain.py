"""
Keychain credential resolver for MCP configuration.

This module resolves @keychain:service:account references in MCP configuration
by reading from environment variables injected by the Electron main process.

Environment variable format: ATTACKTRACE_KEYCHAIN_<SERVICE>_<ACCOUNT>
"""

import os
import re
from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)

KEYCHAIN_PREFIX = "@keychain:"
ENV_PREFIX = "ATTACKTRACE_KEYCHAIN_"


def is_keychain_reference(value: Any) -> bool:
    """Check if a value is a keychain reference string."""
    return isinstance(value, str) and value.startswith(KEYCHAIN_PREFIX)


def parse_keychain_reference(value: str) -> Optional[Dict[str, str]]:
    """
    Parse a keychain reference string.
    
    Args:
        value: Reference string in format "@keychain:service:account"
        
    Returns:
        Dict with 'service' and 'account' keys, or None if invalid
    """
    if not is_keychain_reference(value):
        return None
    
    # Remove prefix
    ref = value[len(KEYCHAIN_PREFIX):]
    
    # Split by colon
    parts = ref.split(":", 1)
    if len(parts) != 2:
        logger.warning(f"Invalid keychain reference format: {value}")
        return None
    
    return {
        "service": parts[0],
        "account": parts[1]
    }


def resolve_keychain_reference(value: str) -> Optional[str]:
    """
    Resolve a keychain reference to its actual value.
    
    Reads from environment variable: ATTACKTRACE_KEYCHAIN_<SERVICE>_<ACCOUNT>
    
    Args:
        value: Keychain reference string
        
    Returns:
        Resolved credential value, or None if not found
    """
    parsed = parse_keychain_reference(value)
    if not parsed:
        return None
    
    service = parsed["service"]
    account = parsed["account"]
    
    # Convert to environment variable name
    # Replace non-alphanumeric characters with underscores
    service_clean = re.sub(r'[^a-zA-Z0-9]', '_', service).upper()
    account_clean = re.sub(r'[^a-zA-Z0-9]', '_', account).upper()
    
    env_key = f"{ENV_PREFIX}{service_clean}_{account_clean}"
    
    credential = os.environ.get(env_key)
    
    if credential:
        logger.info(f"Resolved keychain reference: {service}:{account} from {env_key}")
        return credential
    else:
        logger.warning(f"Keychain credential not found for {service}:{account} (expected env var: {env_key})")
        return None


def resolve_keychain_in_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively resolve all keychain references in a dictionary.
    
    Args:
        data: Dictionary potentially containing keychain references
        
    Returns:
        New dictionary with all keychain references resolved
    """
    result = {}
    
    for key, value in data.items():
        if isinstance(value, str) and is_keychain_reference(value):
            # Try to resolve the reference
            resolved = resolve_keychain_reference(value)
            if resolved is not None:
                result[key] = resolved
            else:
                # Keep original reference if resolution failed
                result[key] = value
                logger.warning(f"Failed to resolve keychain reference for key '{key}': {value}")
        elif isinstance(value, dict):
            # Recursively resolve nested dicts
            result[key] = resolve_keychain_in_dict(value)
        elif isinstance(value, list):
            # Resolve list items
            result[key] = [
                resolve_keychain_reference(item) if is_keychain_reference(item) else item
                for item in value
            ]
        else:
            # Keep non-reference values as-is
            result[key] = value
    
    return result


def resolve_keychain_in_mcp_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Resolve all keychain references in an MCP configuration.
    
    Args:
        config: MCP configuration dict with potential keychain references
        
    Returns:
        New configuration with all keychain references resolved
    """
    if "mcpServers" not in config:
        return config
    
    result = config.copy()
    
    # Resolve keychain references in each MCP server configuration
    resolved_servers = {}
    for server_name, server_config in config["mcpServers"].items():
        if isinstance(server_config, dict):
            resolved_servers[server_name] = resolve_keychain_in_dict(server_config)
        else:
            resolved_servers[server_name] = server_config
    
    result["mcpServers"] = resolved_servers
    
    return result
