# PostgreSQL 配置指南

## 1. 环境变量配置 (.env 文件)

请在 NewmindHub 目录下创建或更新 `.env` 文件，添加以下配置：

```env
# Database Configuration
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:azmatjan1997A@xiaopenges.tocharian.eu:3307/newmind_hub?schema=public"

# Previous MySQL configuration (backup)
# DATABASE_URL="mysql://root:password@localhost:3306/newmind_hub"

# JWT Secret for authentication
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Anthropic API Key for proxy
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN="http://localhost:5173"

# Redis Configuration (optional, for rate limiting)
REDIS_URL="redis://localhost:6379"

# Session Configuration
SESSION_SECRET="your-session-secret-change-this-in-production"
SESSION_MAX_AGE=86400000

# Logging
LOG_LEVEL="info"
```

## 2. 重要说明

- 请确保将 `JWT_SECRET` 和 `SESSION_SECRET` 更改为安全的随机字符串
- 添加您的实际 `ANTHROPIC_API_KEY`
- 数据库连接已配置为您提供的 PostgreSQL 服务器
