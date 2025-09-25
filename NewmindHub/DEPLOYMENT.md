# NewmindHub Elasticsearch MCP 部署指南

## 部署步骤

### 1. 更新数据库Schema

首先，需要应用数据库迁移以支持新的MCP字段：

```bash
# 进入NewmindHub目录
cd /Users/macbook2022/Downloads/project_agent/elk-analysis-agent/Dive/NewmindHub

# 生成Prisma客户端
npm run db:generate

# 应用数据库迁移
mysql -u your_user -p your_database < prisma/migrations/add_mcp_fields.sql

# 或者使用Prisma迁移
npm run db:push
```

### 2. 初始化MCP服务器数据

运行seed脚本以添加Elasticsearch MCP服务器：

```bash
# 运行种子数据
npm run db:seed
```

### 3. 启动Hub服务

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 或开发模式
npm run dev
```

### 4. 验证部署

#### 4.1 测试API端点

```bash
# 登录获取token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"base@test.com","password":"password123"}'

# 搜索MCP服务器（替换YOUR_TOKEN）
curl -X POST http://localhost:3000/api/v1/user/mcp/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"search_input":"elasticsearch","filter":0}'

# 获取用户的MCP配置
curl -X GET http://localhost:3000/api/v1/user/mcp/configs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4.2 在Dive APP中验证

1. 启动Dive APP
2. 登录到Hub（使用测试账号或你的账号）
3. 打开MCP工具管理界面
4. 搜索"Elasticsearch"
5. 应该能看到"Elasticsearch Security MCP"服务器
6. 点击选择并应用
7. 检查本地MCP配置文件是否正确同步

### 5. 生产环境配置

对于生产环境，建议修改Elasticsearch连接配置：

1. 编辑 `prisma/seed.js` 中的环境变量：

```javascript
env: JSON.stringify({
  ES_URL: 'YOUR_PRODUCTION_ES_URL',
  ES_USERNAME: 'YOUR_ES_USERNAME',
  ES_PASSWORD: 'YOUR_ES_PASSWORD',
  NODE_TLS_REJECT_UNAUTHORIZED: '1'  // 生产环境应该验证证书
})
```

2. 或者直接在数据库中更新：

```sql
UPDATE McpServer 
SET env = JSON_OBJECT(
  'ES_URL', 'YOUR_PRODUCTION_ES_URL',
  'ES_USERNAME', 'YOUR_ES_USERNAME',
  'ES_PASSWORD', 'YOUR_ES_PASSWORD',
  'NODE_TLS_REJECT_UNAUTHORIZED', '1'
)
WHERE name = 'Elasticsearch Security MCP';
```

### 6. 故障排除

#### 问题1：Dive APP无法看到新的MCP服务器

- 检查Hub服务是否正常运行
- 验证数据库中是否存在Elasticsearch MCP记录
- 检查API响应是否包含所有必需字段
- 清除Dive APP缓存并重新登录

#### 问题2：MCP服务器无法启动

- 检查环境变量是否正确传递
- 验证npx命令是否可用
- 检查Elasticsearch连接信息是否正确
- 查看Dive的MCP日志文件

#### 问题3：同步失败

- 检查OAP插件是否正确处理stdio类型
- 验证配置文件格式是否正确
- 检查网络连接和认证token

## 测试账号

- BASE用户: base@test.com / password123
- PRO用户: pro@test.com / password123  
- ENTERPRISE用户: enterprise@test.com / password123

## 注意事项

1. **安全性**: 生产环境中不要使用硬编码的密码
2. **证书验证**: 生产环境应启用SSL证书验证
3. **权限控制**: 根据用户订阅计划限制MCP访问
4. **监控**: 添加日志和监控以跟踪MCP使用情况
