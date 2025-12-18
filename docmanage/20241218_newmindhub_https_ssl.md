# NewmindHub HTTPS/SSL 配置指南

## 功能说明

为 NewmindHub 前后端添加 HTTPS/SSL 支持，提高通信安全性。支持通过环境变量配置是否启用 HTTPS 以及证书文件路径。

## 设计思路

### 后端（Express）
- 使用 Node.js 原生 `https` 模块创建 HTTPS 服务器
- 通过环境变量 `ENABLE_HTTPS` 控制是否启用
- 支持配置证书文件路径 `SSL_CERT_FILE` 和 `SSL_KEY_FILE`
- 如果证书加载失败，自动降级到 HTTP

### 前端（Vite）
- Vite 开发服务器原生支持 HTTPS
- 读取与后端相同的环境变量配置
- 自动配置代理目标为 HTTPS（如果启用）
- 开发环境允许自签名证书（`secure: false`）

## 实现细节

### 1. 环境变量配置

在 `.env` 文件中添加以下配置：

```bash
# HTTPS/SSL Configuration
ENABLE_HTTPS=false                # 启用 HTTPS
SSL_CERT_FILE=ssl/cert.pem        # 证书文件路径
SSL_KEY_FILE=ssl/key.pem          # 私钥文件路径

# 前端配置（需与后端一致）
VITE_ENABLE_HTTPS=false
VITE_SSL_CERT_FILE=ssl/cert.pem
VITE_SSL_KEY_FILE=ssl/key.pem
```

### 2. 后端修改 (`src/server.js`)

**导入模块：**
```javascript
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { resolve } from 'path';
```

**创建服务器：**
```javascript
let server;
const enableHttps = process.env.ENABLE_HTTPS === 'true';

if (enableHttps) {
  const httpsOptions = {
    cert: readFileSync(resolve(process.env.SSL_CERT_FILE)),
    key: readFileSync(resolve(process.env.SSL_KEY_FILE))
  };
  server = createHttpsServer(httpsOptions, app);
} else {
  server = createServer(app);
}
```

### 3. 前端修改 (`frontend/vite.config.js`)

**加载环境变量并配置 HTTPS：**
```javascript
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '')
  const enableHttps = env.VITE_ENABLE_HTTPS === 'true'
  
  let httpsConfig = undefined
  if (enableHttps) {
    httpsConfig = {
      cert: readFileSync(resolve('../', env.VITE_SSL_CERT_FILE)),
      key: readFileSync(resolve('../', env.VITE_SSL_KEY_FILE))
    }
  }
  
  return {
    server: {
      https: httpsConfig,
      proxy: {
        '/api': {
          target: enableHttps ? 'https://localhost:23000' : 'http://localhost:23000',
          secure: false // 允许自签名证书
        }
      }
    }
  }
})
```

## 使用方法

### 方式 1：使用脚本生成自签名证书（开发环境）

```bash
# 进入 NewmindHub 目录
cd NewmindHub

# 运行生成脚本
bash generate-ssl-cert.sh

# 或手动生成
mkdir -p ssl
openssl req -x509 -newkey rsa:4096 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -days 365 \
  -nodes \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=Newmind/OU=Dev/CN=localhost"
```

### 方式 2：使用已有证书（生产环境）

将证书文件放置在项目目录下，并在 `.env` 中配置路径：

```bash
# 绝对路径
SSL_CERT_FILE=/etc/ssl/certs/your-cert.pem
SSL_KEY_FILE=/etc/ssl/private/your-key.pem

# 相对路径（相对于项目根目录）
SSL_CERT_FILE=certs/production-cert.pem
SSL_KEY_FILE=certs/production-key.pem
```

### 启用 HTTPS

1. **修改 `.env` 文件：**
   ```bash
   ENABLE_HTTPS=true
   SSL_CERT_FILE=ssl/cert.pem
   SSL_KEY_FILE=ssl/key.pem
   
   VITE_ENABLE_HTTPS=true
   VITE_SSL_CERT_FILE=ssl/cert.pem
   VITE_SSL_KEY_FILE=ssl/key.pem
   
   # 同时更新前端 URL
   HUB_FRONTEND_URL=https://localhost:5174
   VITE_API_BASE_URL=https://localhost:23000
   ```

2. **启动服务：**
   ```bash
   # 后端
   npm start
   
   # 前端（新终端）
   cd frontend
   npm run dev
   ```

3. **访问应用：**
   - 前端：https://localhost:5174
   - 后端 API：https://localhost:23000

### 浏览器警告处理

使用自签名证书时，浏览器会显示安全警告：

**Chrome/Edge：**
- 点击 "高级" → "继续访问 localhost（不安全）"

**Firefox：**
- 点击 "高级" → "接受风险并继续"

**Safari：**
- 点击 "显示详细信息" → "访问此网站"

## 测试结果

### 开发环境测试

```bash
# 1. 生成证书
$ bash generate-ssl-cert.sh
✅ SSL certificate generated successfully!

# 2. 启用 HTTPS
$ ENABLE_HTTPS=true npm start
🚀 NewmindHub server running on https://localhost:23000
🔒 HTTPS: Enabled
📜 SSL Certificate: /path/to/ssl/cert.pem
🔑 SSL Key: /path/to/ssl/key.pem

# 3. 前端启动
$ cd frontend && VITE_ENABLE_HTTPS=true npm run dev
🔒 Vite HTTPS enabled
VITE v5.x.x ready in xxx ms
➜  Local:   https://localhost:5174/
```

### API 测试

```bash
# HTTP（默认）
$ curl http://localhost:23000/api/health
{"status":"ok","service":"NewmindHub"}

# HTTPS（证书启用后）
$ curl -k https://localhost:23000/api/health
{"status":"ok","service":"NewmindHub"}
```

## 生产环境建议

### 使用 Let's Encrypt 免费证书

```bash
# 安装 certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d yourdomain.com

# 证书路径（自动生成）
SSL_CERT_FILE=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_FILE=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# 自动续期
sudo certbot renew --dry-run
```

### 使用 Nginx 反向代理（推荐）

生产环境推荐使用 Nginx 处理 HTTPS，后端保持 HTTP：

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # 前端
    location / {
        proxy_pass http://localhost:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 后端 API
    location /api {
        proxy_pass http://localhost:23000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket
    location /api/v1/socket {
        proxy_pass http://localhost:23000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## 故障排查

### 问题 1：证书加载失败

**错误日志：**
```
Failed to load SSL certificates, falling back to HTTP: ENOENT: no such file or directory
```

**解决方法：**
- 检查证书文件路径是否正确
- 确认文件权限（至少可读）
- 使用绝对路径

### 问题 2：浏览器无法连接

**错误：ERR_SSL_PROTOCOL_ERROR**

**解决方法：**
- 确认前端 URL 使用 `https://` 而非 `http://`
- 清除浏览器缓存
- 检查防火墙设置

### 问题 3：WebSocket 连接失败

**错误：WebSocket connection failed**

**解决方法：**
- WebSocket 也需要使用 `wss://` 协议
- 确保前端配置正确：
  ```javascript
  const ws = new WebSocket('wss://localhost:23000/api/v1/socket');
  ```

### 问题 4：代理连接失败（Vite）

**错误：Proxy error: EPROTO**

**解决方法：**
- 在 Vite 配置中设置 `secure: false`
- 确认后端 HTTPS 已正确启动

## 安全建议

1. **开发环境：**
   - ✅ 使用自签名证书
   - ✅ 在浏览器中接受安全警告
   - ⚠️ 不要将私钥提交到 Git（已加入 `.gitignore`）

2. **生产环境：**
   - ✅ 使用受信任的 CA 证书（Let's Encrypt）
   - ✅ 配置强密码套件和 TLS 1.2+
   - ✅ 使用 Nginx/Caddy 等反向代理
   - ✅ 启用 HSTS、OCSP Stapling
   - ❌ 不要使用自签名证书

3. **证书管理：**
   - 定期更新证书（Let's Encrypt 90 天过期）
   - 设置自动续期任务
   - 监控证书过期时间

## 相关文件

- `NewmindHub/env.example` - 环境变量配置示例
- `NewmindHub/src/server.js` - 后端服务器（HTTPS 支持）
- `NewmindHub/frontend/vite.config.js` - 前端 Vite 配置
- `NewmindHub/generate-ssl-cert.sh` - SSL 证书生成脚本
- `NewmindHub/.gitignore` - 已添加 `ssl/` 目录排除

## 参考链接

- [Node.js HTTPS Documentation](https://nodejs.org/api/https.html)
- [Vite Server Options - HTTPS](https://vitejs.dev/config/server-options.html#server-https)
- [Let's Encrypt](https://letsencrypt.org/)
- [OpenSSL Documentation](https://www.openssl.org/docs/)

---

**版本信息：**
- 创建日期：2024-12-18
- 作者：Newmind AI Team
- 状态：已实现 ✅
