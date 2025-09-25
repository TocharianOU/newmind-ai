# PostgreSQL 迁移和云同步实施文档

## ✅ 已完成的修改

### 1. NewmindHub 数据库迁移
- ✅ Prisma schema 从 MySQL 改为 PostgreSQL
- ✅ 添加了 ChatSession 和 ChatMessage 表用于云同步
- ✅ 创建了同步 API 路由 (`/api/v1/sync/*`)

### 2. MCP-Host 配置更新
- ✅ 配置文件改为使用 PostgreSQL
- ✅ 保留本地 SQLite 作为缓存
- ✅ 添加了同步间隔配置

### 3. 环境配置
```env
# PostgreSQL 连接配置
DATABASE_URL="postgresql://postgres:azmatjan1997A@xiaopenges.tocharian.eu:3307/newmind_hub?schema=public"
```

## 📋 部署步骤

### 1. 创建 .env 文件
```bash
cd /Users/macbook2022/Downloads/project_agent/elk-analysis-agent/Dive/NewmindHub
cp postgresql-config.md .env
# 编辑 .env 文件，添加实际的 API keys
```

### 2. 运行部署脚本
```bash
chmod +x deploy-postgresql.sh
./deploy-postgresql.sh
```

或手动执行：
```bash
# 安装依赖
npm install

# 生成 Prisma 客户端
npx prisma generate

# 创建数据库表结构
npx prisma db push

# 初始化种子数据
node prisma/seed.js

# 启动服务器
npm start
```

## 🔄 同步机制说明

### 数据流程
1. **登录时**：检查本地和云端的 lastSyncedAt，同步较新的数据
2. **聊天时**：消息先写入本地，异步同步到云端
3. **删除时**：标记为 isDeleted，同步删除状态

### API 端点
- `GET /api/v1/sync/sessions` - 获取需要同步的会话
- `POST /api/v1/sync/sessions` - 上传本地会话到云端
- `DELETE /api/v1/sync/sessions/:id` - 删除会话
- `GET /api/v1/sync/status` - 获取同步状态

### 同步策略
- 批量同步间隔：30秒
- 冲突解决：时间戳晚的获胜
- 本地缓存：SQLite 数据库
- 云端存储：PostgreSQL

## 🧪 测试功能

### 1. 测试登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"base@test.com","password":"password123"}'
```

### 2. 测试代理功能
```bash
# 获取 token 后
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "newmind-medium",
    "messages": [{"role":"user","content":"Hello"}],
    "max_tokens": 50
  }'
```

### 3. 测试同步功能
```bash
# 获取同步状态
curl -X GET http://localhost:3000/api/v1/sync/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取会话列表
curl -X GET http://localhost:3000/api/v1/sync/sessions?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ⚠️ 注意事项

1. **安全性**
   - 更改生产环境的 JWT_SECRET
   - 使用环境变量管理敏感信息
   - 启用 HTTPS

2. **性能优化**
   - 调整连接池大小
   - 监控数据库性能
   - 定期清理旧数据

3. **备份策略**
   - 定期备份 PostgreSQL 数据
   - 保留本地 SQLite 作为备份

## 🐛 故障排除

### 问题：数据库连接失败
- 检查网络连接
- 验证数据库凭据
- 确认防火墙设置

### 问题：同步失败
- 检查网络状态
- 查看服务器日志
- 验证用户权限

### 问题：性能问题
- 增加连接池大小
- 优化查询索引
- 考虑使用缓存

## 📊 监控建议

1. 监控数据库连接数
2. 跟踪同步延迟
3. 记录失败的同步操作
4. 监控 API 响应时间
