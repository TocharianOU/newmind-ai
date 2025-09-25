# OAP MCP同步修复总结

## ✅ 已完成的修复

### 1. 修复OAP配置URL读取 
**文件**: `mcp-host/dive_mcp_host/oap_plugin/models.py`
- ✅ 添加了环境变量支持：`HUB_URL` 或 `OAP_ROOT_URL`
- ✅ 默认值改为 `http://localhost:3000`
- ✅ 不再硬编码 `https://oaphub.ai`

### 2. 改进缓存清除机制
**文件**: `mcp-host/dive_mcp_host/oap_plugin/config_mcp_servers.py`
- ✅ `refresh()` 方法现在会清除本地缓存
- ✅ 添加了详细的日志记录
- ✅ 强制从远程重新获取配置

### 3. 添加强制刷新API
**文件**: `mcp-host/dive_mcp_host/oap_plugin/http_handlers.py`
- ✅ 新增 `/api/plugins/oap-platform/config/force-refresh` 端点
- ✅ 清除所有本地缓存后重新获取配置
- ✅ 返回详细的成功/失败信息

### 4. 更新前端调用
**文件**: `src/views/Overlay/Tools/Popup/OAPServerList.tsx`
- ✅ 使用新的强制刷新API
- ✅ 改进错误处理和用户反馈

### 5. 更新配置文件
**文件**: `.config/oap_config.json`
- ✅ 设置正确的 `oap_root_url: "http://localhost:3000"`
- ✅ 包含有效的认证token

## 🔄 需要执行的步骤

### 1. 重启MCP服务
```bash
# 停止当前的 npm run dev
# 然后重新启动
npm run dev
```

### 2. 获取新的认证Token
当前token可能已过期，需要：
1. 在浏览器中登录NewmindHub
2. 从开发者工具Network选项卡获取最新的JWT token
3. 更新 `.config/oap_config.json` 中的 `auth_key`

### 3. 测试完整流程
1. 在OAP商城中选择MCP服务器
2. 点击保存
3. 检查 `.config/mcp_config.json` 是否包含新的MCP服务器

## 📋 验证清单

- [ ] MCP服务重启完成
- [ ] 日志中显示访问 `http://localhost:3000` 而不是 `https://oaphub.ai`
- [ ] 认证token有效（无401错误）
- [ ] OAP商城中选择的MCP服务器能正确同步到本地
- [ ] `.config/mcp_config.json` 包含OAP服务器配置

## 🐛 故障排除

### 如果仍然看到401错误：
```bash
# 更新token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email","password":"your-password"}'
```

### 如果仍然访问错误URL：
- 确认服务已完全重启
- 检查环境变量 `HUB_URL` 是否设置
- 验证 `.config/oap_config.json` 中的URL

### 强制清除缓存：
```bash
curl -X POST http://127.0.0.1:61991/api/plugins/oap-platform/config/force-refresh
```

## 🎯 预期结果

修复完成后，您应该能够：
1. 在OAP商城中选择MCP服务器
2. 看到成功保存的提示
3. 在 `.config/mcp_config.json` 中看到新的MCP服务器配置
4. 在MCP服务器列表中看到同步的服务器

所有修复都已完成，现在需要重启服务并测试！🚀
