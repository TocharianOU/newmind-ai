# 关键硬编码问题修复计划

## 🎯 需要修复的硬编码问题

### 1. 端口号硬编码 (P1)

#### 1.1 MCP Host 端口
```python
# mcp-host/dive_mcp_host/httpd/_main.py:101
start = 61990  # ❌ 硬编码
```
**修复方案**: 使用环境变量 `MCP_HOST_PORT`

#### 1.2 测试端口
```python
# mcp-host/tests/oap_plugin/test_oap_plugin.py:38
app.set_listen_port(61990)  # ❌ 硬编码

# mcp-host/tests/httpd/routers/conftest.py:141  
app.set_listen_port(61990)  # ❌ 硬编码
```
**修复方案**: 使用环境变量或配置

### 2. URL 硬编码 (P1)

#### 2.1 Tauri 中的 OAP URL
```rust
// src-tauri/src/shared.rs:3
pub const OAP_ROOT_URL: &str = "http://localhost:3000";  // ❌ 硬编码
```
**修复方案**: 使用环境变量或配置文件

#### 2.2 生产环境 URL
```javascript
// NewmindHub/src/config/constants.js:12
'newmind-small': { 
  type: 'lmstudio', 
  endpoint: '/v1/chat/completions', 
  url: 'http://xiaopenges.tocharian.eu:11234'  // ❌ 硬编码生产URL
}

// NewmindHub/prisma/seed.js:76
ES_URL: 'https://xiaopenges.tocharian.eu:9201',  // ❌ 硬编码生产URL
```
**修复方案**: 使用环境变量

### 3. 测试代码中的硬编码 (P2)

#### 3.1 测试 URL
```python
# mcp-host/tests/conftest.py
url=f"http://localhost:{port}/sse",  # ❌ 硬编码 localhost
```
**修复方案**: 使用配置或环境变量

## 🔧 修复实施计划

### 阶段 1: 环境变量配置

#### 1.1 创建环境变量配置
```bash
# .env.example
MCP_HOST_PORT=61990
OAP_ROOT_URL=http://localhost:3000
PRODUCTION_API_URL=http://xiaopenges.tocharian.eu:11234
PRODUCTION_ES_URL=https://xiaopenges.tocharian.eu:9201
```

#### 1.2 更新配置文件
```typescript
// src/config/env.ts
export const ENV_CONFIG = {
  MCP_HOST_PORT: process.env.MCP_HOST_PORT || 61990,
  OAP_ROOT_URL: process.env.OAP_ROOT_URL || 'http://localhost:3000',
  PRODUCTION_API_URL: process.env.PRODUCTION_API_URL,
  PRODUCTION_ES_URL: process.env.PRODUCTION_ES_URL,
} as const;
```

### 阶段 2: 代码修复

#### 2.1 修复 MCP Host 端口
```python
# mcp-host/dive_mcp_host/httpd/_main.py
import os
start = int(os.getenv("MCP_HOST_PORT", "61990"))
```

#### 2.2 修复 Tauri OAP URL
```rust
// src-tauri/src/shared.rs
use std::env;

pub fn get_oap_root_url() -> String {
    env::var("OAP_ROOT_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
}
```

#### 2.3 修复生产环境 URL
```javascript
// NewmindHub/src/config/constants.js
const PRODUCTION_API_URL = process.env.PRODUCTION_API_URL || 'http://localhost:11234';

export const MODEL_CONFIGS = {
  'newmind-small': { 
    type: 'lmstudio', 
    endpoint: '/v1/chat/completions', 
    url: PRODUCTION_API_URL
  }
};
```

### 阶段 3: 测试修复

#### 3.1 测试端口配置
```python
# mcp-host/tests/conftest.py
import os
test_port = int(os.getenv("TEST_MCP_PORT", "61990"))
```

## 📋 修复优先级

### P0 (立即修复)
- [ ] 生产环境 URL 硬编码 (安全风险)
- [ ] MCP Host 端口硬编码 (部署问题)

### P1 (本周修复)  
- [ ] Tauri OAP URL 硬编码
- [ ] 测试代码中的硬编码

### P2 (下个版本)
- [ ] 其他测试相关硬编码

## 🚀 实施步骤

1. **创建环境变量配置**
2. **修复 MCP Host 端口配置**
3. **修复 Tauri OAP URL**
4. **修复生产环境 URL**
5. **更新测试代码**
6. **验证所有修复**

---

**注意**: 文档、prompt、示例文件中的硬编码已排除，只关注实际代码中的硬编码问题。
