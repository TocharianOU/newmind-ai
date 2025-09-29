# NewMind Hub 部署和测试指南

## 🎉 已完成的所有功能

### 1. ✅ 后端API (NewmindHub Express服务)
- [x] 用户设置API (`GET/PUT /api/v1/user/settings`)
- [x] 用户偏好API (`GET/PUT /api/v1/user/preferences`)
- [x] 用户统计API (`GET /api/v1/user/stats`)
- [x] 注册API验证完整
- [x] 认证、登录、登出功能
- [x] 模型代理和使用记录

### 2. ✅ 数据库Schema
- [x] UserPreferences表已添加
- [x] UsageRecord字段修正 (`model` → `modelName`)
- [x] 所有关系和索引正确配置

### 3. ✅ Hub管理后台前端
- [x] React + Vite项目结构
- [x] 登录和注册页面（美观的UI）
- [x] 仪表盘（图表、统计、使用量）
- [x] 设置页面（用户信息、偏好）
- [x] 响应式布局和导航
- [x] 认证上下文和路由保护

### 4. ✅ APP集成
- [x] 注册按钮跳转到Hub平台
- [x] 用户名修改弹窗
- [x] API同步和状态更新

## 🚀 部署步骤

### Step 1: 数据库迁移

```bash
cd /Users/macbook2022/Downloads/project_agent/elk-analysis-agent/2.0version/newmind-ai/NewmindHub

# 生成并应用迁移
npx prisma migrate dev --name add_user_preferences_and_fix_usage_record

# 生成Prisma Client
npx prisma generate
```

### Step 2: 启动NewmindHub后端

```bash
cd /Users/macbook2022/Downloads/project_agent/elk-analysis-agent/2.0version/newmind-ai/NewmindHub

# 确保环境变量配置
# DATABASE_URL, JWT_SECRET, etc.

npm run dev
```

后端将运行在 `http://localhost:3000`

### Step 3: 启动Hub前端

```bash
cd /Users/macbook2022/Downloads/project_agent/elk-analysis-agent/2.0version/newmind-ai/NewmindHub/frontend

npm run dev
```

前端将运行在 `http://localhost:5173`

### Step 4: 启动MCP-Host

```bash
cd /Users/macbook2022/Downloads/project_agent/elk-analysis-agent/2.0version/newmind-ai/mcp-host

# 根据你的启动脚本
python -m dive_mcp_host.httpd.server
```

### Step 5: 启动Dive APP

```bash
cd /Users/macbook2022/Downloads/project_agent/elk-analysis-agent/2.0version/newmind-ai

npm run dev
```

## 🧪 测试流程

### 测试1: 用户注册流程

1. 打开Dive APP
2. 点击"注册"按钮
3. 应该打开浏览器到 `http://localhost:5173/register`
4. 填写注册信息：
   - Email: test@example.com
   - Username: TestUser
   - Password: test123
   - Confirm Password: test123
5. 注册成功后应跳转到Dashboard

**预期结果**: 
- ✅ 浏览器正确打开注册页面
- ✅ 注册成功
- ✅ 自动登录并进入Dashboard

### 测试2: Hub平台登录和仪表盘

1. 在浏览器访问 `http://localhost:5173/login`
2. 使用刚注册的账号登录
3. 查看Dashboard：
   - 总调用次数
   - Token使用量
   - 每日使用趋势图表
   - 模型使用统计表格

**预期结果**:
- ✅ 登录成功
- ✅ Dashboard正确显示统计数据
- ✅ 图表渲染正常
- ✅ 用户信息显示正确

### 测试3: 用户设置修改

1. 在Hub平台点击"Settings"
2. 修改用户名
3. 修改偏好设置（主题、语言）
4. 点击"Save"

**预期结果**:
- ✅ 修改成功提示
- ✅ 顶部导航栏用户名更新
- ✅ 刷新页面数据保持

### 测试4: APP内嵌登录

1. 在Dive APP点击"登录"
2. 在嵌入式弹窗中输入凭据
3. 登录成功

**预期结果**:
- ✅ 弹窗正确显示
- ✅ 登录成功
- ✅ 用户信息加载到APP

### 测试5: APP内用户名修改

1. 在Dive APP进入Account/Settings
2. 点击用户名旁边的编辑按钮
3. 修改用户名
4. 保存

**预期结果**:
- ✅ 弹窗正确显示
- ✅ 修改成功
- ✅ Header和Account页面用户名更新
- ✅ Hub平台同步更新

### 测试6: 使用统计追踪

1. 在Dive APP进行几次AI对话
2. 回到Hub平台Dashboard
3. 刷新页面查看统计

**预期结果**:
- ✅ 调用次数增加
- ✅ Token使用量增加
- ✅ 图表数据更新
- ✅ 模型统计正确分类

## 🐛 常见问题排查

### 问题1: 数据库迁移失败

**症状**: `prisma migrate` 报错

**解决方案**:
```bash
# 重置数据库（开发环境）
npx prisma migrate reset

# 重新迁移
npx prisma migrate dev

# 重新生成Client
npx prisma generate
```

### 问题2: Hub前端无法连接后端

**症状**: API调用返回网络错误

**检查**:
1. 确认NewmindHub后端运行在 `http://localhost:3000`
2. 检查 `frontend/.env` 文件
3. 检查 `frontend/vite.config.js` 的proxy配置
4. 查看浏览器Console的错误信息

**解决方案**:
```bash
# 检查后端状态
curl http://localhost:3000/api/v1/user/me

# 重启前端开发服务器
cd frontend
npm run dev
```

### 问题3: APP注册按钮不跳转

**症状**: 点击注册按钮无反应

**检查**:
1. 查看Electron/Tauri控制台错误
2. 确认 `src/ipc/oap.ts` 修改正确
3. Hub前端是否运行

**解决方案**:
- Electron: 确保 `shell.openExternal` 可用
- Tauri: 确保 `open_url` 命令注册
- 或使用fallback: `window.open(url, '_blank')`

### 问题4: 用户名修改不生效

**症状**: 修改用户名后不更新

**检查**:
1. 浏览器Console查看API响应
2. 确认token正确传递
3. 检查 `oapGetMe()` 是否被调用

**解决方案**:
```typescript
// 在EditUsernameModal成功后
await oapGetMe(); // 刷新用户数据
```

### 问题5: CORS错误

**症状**: 浏览器Console显示CORS错误

**解决方案**:
在 `NewmindHub/src/server.js` 添加：
```javascript
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
```

## 📊 API端点清单

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新token

### 用户管理
- `GET /api/v1/user/me` - 获取当前用户信息
- `GET /api/v1/user/usage` - 获取使用量
- `GET /api/v1/user/stats?range=30d` - 获取统计数据
- `GET /api/v1/user/settings` - 获取用户设置
- `PUT /api/v1/user/settings` - 更新用户设置
- `GET /api/v1/user/preferences` - 获取用户偏好
- `PUT /api/v1/user/preferences` - 更新用户偏好
- `POST /api/v1/user/logout` - 登出

### 模型相关
- `GET /api/v1/models` - 获取可用模型列表
- `POST /api/v1/chat/completions` - OpenAI兼容端点

## 🔐 安全检查清单

- [x] JWT token加密
- [x] 密码bcrypt哈希
- [x] API认证中间件
- [x] CORS配置
- [x] SQL注入防护（Prisma）
- [x] XSS防护（React自动转义）
- [ ] Rate limiting（建议添加）
- [ ] HTTPS（生产环境必需）

## 📝 环境变量配置

### NewmindHub/.env
```env
DATABASE_URL="postgresql://user:password@localhost:5432/newmind"
JWT_SECRET="your-secret-key-here-change-in-production"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"
PORT=3000
```

### Hub/frontend/.env
```env
VITE_API_BASE_URL=http://localhost:3000
```

## 🎯 下一步优化建议

1. **性能优化**
   - 添加Redis缓存
   - 实现API响应压缩
   - 优化数据库查询

2. **功能增强**
   - 添加邮件验证
   - 实现密码重置
   - 添加OAuth登录

3. **监控和日志**
   - 集成日志系统
   - 添加性能监控
   - 实现错误追踪

4. **部署**
   - Docker容器化
   - CI/CD pipeline
   - 生产环境配置

## ✅ 完成状态

所有计划功能已100%完成！🎉

- ✅ 后端API完整
- ✅ 数据库Schema正确
- ✅ Hub前端完整功能
- ✅ APP集成完成
- ✅ 测试流程明确

现在可以开始测试和部署了！
