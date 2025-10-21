# 硬编码配置说明

## 问题背景

在不同环境（开发、测试、生产）中，如果使用环境变量来配置邀请码和下载地址，可能会出现以下问题：

1. **环境变量未正确传递**：某些电脑或 Docker 环境中环境变量没有正确设置
2. **显示不一致**：不同环境看到的功能不一样（有的有邀请码，有的没有）
3. **调试困难**：很难追踪是哪里的配置出了问题

## 解决方案

**使用硬编码配置文件**，集中管理所有关键配置，确保所有环境显示一致。

## 配置文件位置

```
NewmindHub/src/config/hardcoded.js
```

## 配置内容

### 1. 邀请码配置

```javascript
// 是否启用邀请码功能
INVITE_CODE_ENABLED: true,

// 有效的邀请码列表
VALID_INVITE_CODES: [
  'hellonewmind',
  'newmind2024',
  'welcome'
]
```

### 2. 下载地址配置

```javascript
DOWNLOAD_URLS: {
  windows: {
    x64: '' // Windows x64 下载地址（待配置）
  },
  macos: {
    intel: 'http://xiaopenges.tocharian.eu/download/NewmindChat-electron-1.0.0-mac-x64.dmg',
    appleSilicon: 'http://xiaopenges.tocharian.eu/download/NewmindChat-electron-1.0.0-mac-arm64.dmg'
  },
  linux: {
    x64: '',   // Linux x64 下载地址（待配置）
    arm64: ''  // Linux ARM64 下载地址（待配置）
  }
}
```

## 如何修改配置

### 步骤 1：编辑配置文件

```bash
vim NewmindHub/src/config/hardcoded.js
```

### 步骤 2：修改你需要的配置

例如添加新邀请码：

```javascript
VALID_INVITE_CODES: [
  'hellonewmind',
  'newmind2024',
  'welcome',
  'newcode123'  // 新增邀请码
]
```

或者添加 Windows 下载地址：

```javascript
windows: {
  x64: 'http://xiaopenges.tocharian.eu/download/NewmindChat-electron-1.0.0-win-x64.exe'
}
```

### 步骤 3：重启后端服务

```bash
# 方法 1：使用 docker-compose 重启
cd /home/newmind-ai/NewmindHub
docker-compose restart backend

# 方法 2：重新构建并启动
cd /home/newmind-ai/NewmindHub
docker-compose build backend
docker-compose up -d backend
```

### 步骤 4：验证配置

```bash
# 检查邀请码配置
curl http://localhost:23000/api/auth/config | jq '.'

# 检查下载地址配置
curl http://localhost:23000/api/auth/download-config | jq '.'
```

## 优势

✅ **一致性**：所有环境使用相同的配置，不会出现不一致  
✅ **可控性**：配置在代码仓库中，可以版本控制  
✅ **简单性**：不需要在每个环境设置环境变量  
✅ **可维护性**：集中在一个文件，修改方便  

## 注意事项

⚠️ **修改后必须重启**：修改配置文件后必须重启后端服务才能生效  
⚠️ **敏感信息**：如果有敏感配置（如 API Key），仍然建议使用环境变量  
⚠️ **版本控制**：配置文件会被提交到 Git，确保不包含敏感信息  

## 相关文件

- `NewmindHub/src/config/hardcoded.js` - 硬编码配置文件
- `NewmindHub/src/routes/auth.js` - 使用配置的路由文件

## 测试

测试注册功能（需要邀请码）：

```bash
curl -X POST http://localhost:23000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "inviteCode": "hellonewmind"
  }'
```

测试下载配置：

```bash
curl http://localhost:23000/api/auth/download-config
```

## 当前有效的邀请码

- `hellonewmind`
- `newmind2024`
- `welcome`

---

**创建时间**：2025-10-21  
**最后更新**：2025-10-21

