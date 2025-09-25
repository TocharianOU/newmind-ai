#!/usr/bin/env python3
"""
OAP Authentication Setup Script

This script helps set up authentication for OAP MCP server synchronization.
"""

import json
import sys
from pathlib import Path
import httpx
import asyncio
from dive_mcp_host.oap_plugin.models import OAPConfig
from dive_mcp_host.env import DIVE_CONFIG_DIR

CONFIG_FILE = Path(DIVE_CONFIG_DIR, "oap_config.json")


async def test_auth_token(token: str, oap_root_url: str = "https://oaphub.ai") -> bool:
    """Test if the auth token is valid."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{oap_root_url}/api/v1/user/mcp/configs",
                headers={"Authorization": f"Bearer {token}"}
            )
            return response.status_code == 200
    except Exception as e:
        print(f"Error testing token: {e}")
        return False


def read_current_config() -> OAPConfig:
    """Read current OAP config."""
    if CONFIG_FILE.exists():
        try:
            with CONFIG_FILE.open("r") as f:
                return OAPConfig.model_validate_json(f.read())
        except Exception as e:
            print(f"Error reading config: {e}")
    return OAPConfig()


def save_config(config: OAPConfig) -> None:
    """Save OAP config."""
    CONFIG_FILE.parent.mkdir(exist_ok=True)
    with CONFIG_FILE.open("w") as f:
        f.write(config.model_dump_json(indent=2))


async def main():
    print("🔧 OAP Authentication Setup")
    print("=" * 40)
    
    current_config = read_current_config()
    
    if current_config.auth_key:
        print(f"📋 Current auth_key: {current_config.auth_key[:20]}...")
        print(f"🌐 OAP root URL: {current_config.oap_root_url}")
        
        # Test current token
        print("\n🔍 Testing current authentication...")
        if await test_auth_token(current_config.auth_key, current_config.oap_root_url):
            print("✅ Current authentication is valid!")
            
            choice = input("\n❓ Do you want to update the token? (y/N): ").lower()
            if choice not in ['y', 'yes']:
                print("👋 No changes made. Exiting.")
                return
        else:
            print("❌ Current authentication is invalid!")
            print("🔄 Please provide a new token.")
    else:
        print("⚠️  No authentication token found.")
    
    print("\n📝 Please enter your authentication token:")
    print("   (You can get this from your OAP account settings)")
    
    token = input("🔑 Auth Token: ").strip()
    
    if not token:
        print("❌ No token provided. Exiting.")
        sys.exit(1)
    
    print("\n🔍 Testing new authentication token...")
    if await test_auth_token(token, current_config.oap_root_url):
        print("✅ Authentication token is valid!")
        
        # Update config
        current_config.auth_key = token
        save_config(current_config)
        
        print(f"💾 Configuration saved to: {CONFIG_FILE}")
        print("\n🎉 Setup complete!")
        print("📋 Next steps:")
        print("   1. Restart your MCP host service")
        print("   2. Try selecting MCP servers from OAP store")
        print("   3. Check that they sync to your local MCP config")
        
    else:
        print("❌ Authentication token is invalid!")
        print("🔄 Please check your token and try again.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
