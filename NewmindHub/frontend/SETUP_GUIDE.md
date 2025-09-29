# NewMind Hub Frontend Setup Guide

## 已完成的文件

✅ `/src/config/api.js` - API配置和axios实例
✅ `/src/contexts/AuthContext.jsx` - 认证上下文
✅ `/src/pages/Login.jsx` - 登录页面
✅ `/src/pages/Register.jsx` - 注册页面  
✅ `/src/pages/Auth.css` - 认证页面样式
✅ `/src/pages/Dashboard.jsx` - 仪表盘页面

## 需要创建的文件

### 1. Dashboard样式
文件: `/src/pages/Dashboard.css`
- 仪表盘整体布局
- 统计卡片样式
- 图表容器样式
- 表格样式

### 2. Settings页面
文件: `/src/pages/Settings.jsx`
- 用户信息修改（用户名、头像）
- 偏好设置（主题、语言）
- 密码修改

### 3. Layout组件
文件: `/src/components/Layout.jsx`
- 顶部导航栏
- 侧边栏
- 用户菜单

### 4. App.jsx主文件
文件: `/src/App.jsx`
- 路由配置
- AuthProvider包装
- Protected Route

### 5. 环境变量
文件: `/.env`
```
VITE_API_BASE_URL=http://localhost:3000
```

### 6. Vite配置
文件: `/vite.config.js`
- 代理配置
- 端口配置

## 启动步骤

1. 数据库迁移:
```bash
cd /Users/macbook2022/Downloads/project_agent/elk-analysis-agent/2.0version/newmind-ai/NewmindHub
npx prisma migrate dev --name add_user_preferences
npx prisma generate
```

2. 启动后端:
```bash
npm run dev
```

3. 启动前端:
```bash
cd frontend
npm run dev
```

## API端点确认

✅ POST /api/auth/login
✅ POST /api/auth/register  
✅ GET /api/v1/user/me
✅ GET /api/v1/user/usage
✅ GET /api/v1/user/stats?range=30d
✅ GET /api/v1/user/settings
✅ PUT /api/v1/user/settings
✅ GET /api/v1/user/preferences
✅ PUT /api/v1/user/preferences
✅ POST /api/v1/user/logout

## APP集成

### 修改注册按钮
文件: `/2.0version/newmind-ai/src/views/Login.tsx`
- 将注册按钮改为打开浏览器到Hub注册页面
- URL: `http://localhost:5173/register`

### 添加用户名修改功能
文件: `/2.0version/newmind-ai/src/components/Header.tsx`
- 添加设置菜单
- 调用 PUT /api/v1/user/settings 更新用户名
- 刷新用户信息

## 下一步

1. 完成剩余前端文件创建
2. 运行数据库迁移
3. 测试所有API端点
4. 集成到APP中
5. 测试端到端流程
