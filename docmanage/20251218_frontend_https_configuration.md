# Frontend HTTPS 配置指南

## 概述
将前端的 HTTPS 配置从后端分离，使前端有独立的环境配置文件。

**日期**: 2025-12-18  
**影响组件**: NewmindHub Frontend

---

## 变更说明

### 1. 配置文件分离
- **之前**: 前端从 `NewmindHub/.env` 读取配置（与后端混在一起）
- **之后**: 前端从 `NewmindHub/frontend/.env` 读取配置（独立管理）

### 2. 修改的文件
- `NewmindHub/frontend/vite.config.js` - 修改 loadEnv 路径
- `NewmindHub/frontend/env.example` - 更新配置模板

---

## 配置步骤

### 步骤 1: 创建前端 .env 文件

```bash
cd NewmindHub/frontend
cp env.example .env
```

### 步骤 2: 编辑 frontend/.env 文件

```bash
# 后端 API 地址（如果后端启用 HTTPS，改为 https://）
VITE_API_BASE_URL=https://localhost:23000

# 启用前端 HTTPS
VITE_ENABLE_HTTPS=true

# SSL 证书路径（相对于 NewmindHub/ 目录）
VITE_SSL_CERT_FILE=ssl/cert.pem
VITE_SSL_KEY_FILE=ssl/key.pem

# 前端端口
VITE_PORT=5174
```

### 步骤 3: 重启前端开发服务器

```bash
# 在 NewmindHub/frontend/ 目录
npm run dev
```

---

## 配置说明

### VITE_API_BASE_URL
- 后端 API 的完整 URL
- **HTTP 后端**: `http://localhost:23000`
- **HTTPS 后端**: `https://localhost:23000`

### VITE_ENABLE_HTTPS
- 控制前端开发服务器是否使用 HTTPS
- `true`: 启用 HTTPS（前端运行在 https://localhost:5174）
- `false`: 使用 HTTP（前端运行在 http://localhost:5174）

### VITE_SSL_CERT_FILE / VITE_SSL_KEY_FILE
- SSL 证书和私钥文件路径
- **路径基准**: 相对于 `NewmindHub/` 目录（不是 `frontend/` 目录）
- **示例**: `ssl/cert.pem` → 实际路径 `NewmindHub/ssl/cert.pem`

---

## 常见场景

### 场景 1: 前后端都启用 HTTPS（推荐）

**后端配置** (`NewmindHub/.env`):
```bash
ENABLE_HTTPS=true
SSL_CERT_FILE=ssl/cert.pem
SSL_KEY_FILE=ssl/key.pem
PORT=23000
```

**前端配置** (`NewmindHub/frontend/.env`):
```bash
VITE_API_BASE_URL=https://localhost:23000
VITE_ENABLE_HTTPS=true
VITE_SSL_CERT_FILE=ssl/cert.pem
VITE_SSL_KEY_FILE=ssl/key.pem
VITE_PORT=5174
```

**访问地址**:
- 前端: https://localhost:5174
- 后端 API: https://localhost:23000

### 场景 2: 前后端都使用 HTTP（开发快速模式）

**后端配置** (`NewmindHub/.env`):
```bash
ENABLE_HTTPS=false
PORT=23000
```

**前端配置** (`NewmindHub/frontend/.env`):
```bash
VITE_API_BASE_URL=http://localhost:23000
VITE_ENABLE_HTTPS=false
VITE_PORT=5174
```

**访问地址**:
- 前端: http://localhost:5174
- 后端 API: http://localhost:23000

### 场景 3: 仅后端启用 HTTPS（不推荐）

**后端配置** (`NewmindHub/.env`):
```bash
ENABLE_HTTPS=true
SSL_CERT_FILE=ssl/cert.pem
SSL_KEY_FILE=ssl/key.pem
PORT=23000
```

**前端配置** (`NewmindHub/frontend/.env`):
```bash
VITE_API_BASE_URL=https://localhost:23000
VITE_ENABLE_HTTPS=false
VITE_PORT=5174
```

**访问地址**:
- 前端: http://localhost:5174
- 后端 API: https://localhost:23000

⚠️ **注意**: 浏览器可能会阻止混合内容（HTTP 页面访问 HTTPS API）

---

## 故障排查

### 问题 1: 前端日志显示 "HTTPS: Disabled" 但配置是 true

**原因**: `VITE_ENABLE_HTTPS` 拼写错误或配置文件位置错误

**检查**:
```bash
# 确认文件存在
ls -la NewmindHub/frontend/.env

# 检查配置内容
cat NewmindHub/frontend/.env | grep VITE_ENABLE_HTTPS
```

**确保**:
- ✅ 拼写正确: `VITE_ENABLE_HTTPS=true`（不是 `ture`）
- ✅ 文件位置: `NewmindHub/frontend/.env`

### 问题 2: SSL 证书加载失败

**错误日志**:
```
Failed to load SSL certificates for Vite, falling back to HTTP: ENOENT: no such file or directory
```

**原因**: 证书文件路径不正确

**解决**:
1. 检查证书文件是否存在:
   ```bash
   ls -la NewmindHub/ssl/
   ```

2. 确认路径相对于 `NewmindHub/` 目录:
   ```bash
   # 正确 ✅
   VITE_SSL_CERT_FILE=ssl/cert.pem
   
   # 错误 ❌
   VITE_SSL_CERT_FILE=../ssl/cert.pem
   ```

3. 如果证书不存在，生成自签名证书:
   ```bash
   cd NewmindHub
   mkdir -p ssl
   openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
   ```

### 问题 3: 前端无法连接后端

**症状**: API 请求失败，控制台显示网络错误

**检查清单**:
1. 后端是否正在运行？
   ```bash
   curl http://localhost:23000/api/health
   # 或者（HTTPS）
   curl -k https://localhost:23000/api/health
   ```

2. `VITE_API_BASE_URL` 是否正确？
   - 如果后端是 HTTPS，前端也要配置 `https://`
   - 端口号是否匹配后端的 `PORT`

3. 浏览器是否阻止自签名证书？
   - 访问后端地址（如 https://localhost:23000/api/health）
   - 点击"高级"→"继续访问"接受证书

---

## 技术细节

### Vite 配置变更

**修改前** (`vite.config.js`):
```javascript
const env = loadEnv(mode, '../', '')  // 从父目录读取
```

**修改后**:
```javascript
const env = loadEnv(mode, process.cwd(), '')  // 从当前目录读取
```

### 环境变量读取顺序
1. Vite 读取 `frontend/.env`
2. 只读取 `VITE_` 前缀的变量（暴露给浏览器）
3. 非 `VITE_` 前缀的变量只在构建时可用

### HTTPS 服务器配置
```javascript
// vite.config.js
server: {
  port: 5174,
  https: {
    cert: readFileSync('ssl/cert.pem'),
    key: readFileSync('ssl/key.pem')
  }
}
```

---

## 安全建议

### 开发环境
- ✅ 使用自签名证书
- ✅ 证书有效期 365 天
- ✅ `.env` 文件已在 `.gitignore` 中

### 生产环境
- ⚠️ 使用正式 CA 签发的证书（Let's Encrypt）
- ⚠️ 配置 HSTS 和 CSP 安全头
- ⚠️ 定期更新证书（自动化）

---

## 相关文档

- [HTTPS 快速启动指南](../NewmindHub/HTTPS_QUICK_START.md)
- [HTTPS 完整配置指南](../NewmindHub/HTTPS_CONFIG_GUIDE.md)
- [Vite HTTPS 配置](https://vitejs.dev/config/server-options.html#server-https)

---

## 版本历史

- **v1.0** (2025-12-18): 初始版本
  - 分离前后端 HTTPS 配置
  - 修改 vite.config.js loadEnv 路径
  - 更新 frontend/env.example 模板
