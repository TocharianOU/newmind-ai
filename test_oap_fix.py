#!/usr/bin/env python3
"""
测试OAP配置修复
"""

import os
import sys
sys.path.append('/Users/macbook2022/Downloads/project_agent/elk-analysis-agent/Dive/mcp-host')

from dive_mcp_host.oap_plugin.models import OAPConfig
from dive_mcp_host.oap_plugin.config_mcp_servers import read_oap_config

def test_oap_config():
    print("🧪 Testing OAP Configuration")
    print("=" * 40)
    
    # 测试默认配置
    print("1️⃣ Testing default OAPConfig...")
    default_config = OAPConfig()
    print(f"   Default oap_root_url: {default_config.oap_root_url}")
    
    # 测试环境变量
    print("\n2️⃣ Testing with HUB_URL environment variable...")
    os.environ["HUB_URL"] = "http://test-hub:4000"
    env_config = OAPConfig()
    print(f"   With HUB_URL=http://test-hub:4000: {env_config.oap_root_url}")
    
    # 清理环境变量
    del os.environ["HUB_URL"]
    
    # 测试OAP_ROOT_URL环境变量
    print("\n3️⃣ Testing with OAP_ROOT_URL environment variable...")
    os.environ["OAP_ROOT_URL"] = "http://oap-test:5000"
    env_config2 = OAPConfig()
    print(f"   With OAP_ROOT_URL=http://oap-test:5000: {env_config2.oap_root_url}")
    
    # 清理环境变量
    del os.environ["OAP_ROOT_URL"]
    
    # 测试读取配置文件
    print("\n4️⃣ Testing config file reading...")
    try:
        file_config = read_oap_config()
        print(f"   Config file oap_root_url: {file_config.oap_root_url}")
        print(f"   Config file auth_key: {file_config.auth_key[:20] if file_config.auth_key else 'None'}...")
    except Exception as e:
        print(f"   Error reading config file: {e}")
    
    print("\n✅ Test completed!")
    print("\n💡 Expected behavior:")
    print("   - Without env vars: http://localhost:3000")
    print("   - With HUB_URL: uses HUB_URL value")
    print("   - With OAP_ROOT_URL: uses OAP_ROOT_URL value")
    print("   - Config file should show: http://localhost:3000")

if __name__ == "__main__":
    test_oap_config()
