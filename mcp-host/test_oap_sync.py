#!/usr/bin/env python3
"""
Test OAP MCP Synchronization

This script tests the complete OAP MCP synchronization flow.
"""

import json
import asyncio
from pathlib import Path
import httpx
from oap_mcp_host.oap_plugin.config_mcp_servers import MCPServerManagerPlugin, read_oap_config
from oap_mcp_host.httpd.conf.mcp_servers import MCPServerManager, Config
from oap_mcp_host.env import OAP_CONFIG_DIR

MCP_CONFIG_FILE = Path(OAP_CONFIG_DIR, "mcp_config.json")


async def test_oap_sync():
    """Test the complete OAP sync flow."""
    print("🧪 Testing OAP MCP Synchronization")
    print("=" * 40)
    
    # 1. Check OAP config
    print("1️⃣ Checking OAP configuration...")
    oap_config = read_oap_config()
    
    if not oap_config.auth_key:
        print("❌ No auth_key found in OAP config")
        print("💡 Run setup_oap_auth.py first to set up authentication")
        return False
    
    print(f"✅ Auth key found: {oap_config.auth_key[:20]}...")
    
    # 2. Test API connection
    print("\n2️⃣ Testing OAP API connection...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{oap_config.oap_root_url}/api/v1/user/mcp/configs",
                headers={"Authorization": f"Bearer {oap_config.auth_key}"}
            )
            
            if response.status_code == 200:
                configs = response.json()
                print(f"✅ API connection successful")
                print(f"📊 Found {len(configs.get('data', []))} MCP configurations")
            else:
                print(f"❌ API connection failed: HTTP {response.status_code}")
                print(f"🔍 Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ API connection error: {e}")
        return False
    
    # 3. Test MCP plugin
    print("\n3️⃣ Testing MCP plugin...")
    try:
        plugin = MCPServerManagerPlugin(oap_config.auth_key, oap_config.oap_root_url)
        
        # Create a mock MCP server manager
        mock_manager = MCPServerManager()
        mock_manager.initialize()
        
        # Test config callback
        current_config = await mock_manager.get_current_config()
        if current_config is None:
            current_config = Config()
        
        updated_config = await plugin.current_config_callback(current_config)
        
        print("✅ MCP plugin working correctly")
        print(f"📊 MCP servers in config: {len(updated_config.mcp_servers)}")
        
        # Show OAP servers
        oap_servers = [
            name for name, server in updated_config.mcp_servers.items()
            if server.extra_data and server.extra_data.get("oap")
        ]
        
        if oap_servers:
            print(f"🎯 OAP MCP servers found: {', '.join(oap_servers)}")
        else:
            print("ℹ️  No OAP MCP servers configured (this is normal if none are selected)")
        
    except Exception as e:
        print(f"❌ MCP plugin error: {e}")
        return False
    
    # 4. Check local MCP config
    print("\n4️⃣ Checking local MCP configuration...")
    if MCP_CONFIG_FILE.exists():
        with MCP_CONFIG_FILE.open("r") as f:
            local_config = json.load(f)
        
        total_servers = len(local_config.get("mcpServers", {}))
        oap_servers = [
            name for name, server in local_config.get("mcpServers", {}).items()
            if server.get("extraData", {}).get("oap")
        ]
        
        print(f"✅ Local MCP config found")
        print(f"📊 Total MCP servers: {total_servers}")
        print(f"🎯 OAP MCP servers: {len(oap_servers)}")
        
        if oap_servers:
            print(f"   └─ {', '.join(oap_servers)}")
    else:
        print("⚠️  Local MCP config not found")
    
    print("\n🎉 All tests completed successfully!")
    print("\n💡 If you're not seeing your selected MCP servers:")
    print("   1. Make sure you've selected and saved servers in the OAP store")
    print("   2. Check that the config refresh API is being called")
    print("   3. Restart the MCP host service")
    
    return True


if __name__ == "__main__":
    asyncio.run(test_oap_sync())
