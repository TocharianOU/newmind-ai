# AttackTrace 安全修复清单

**更新时间**: 2026-02-11  
**优先级**: 🔴 P0 > 🟠 P1 > 🟡 P2

---

## 🔴 P0 - 关键安全漏洞（立即修复）

### 认证与凭证
- [x] **OAP Token 明文存储** ✅ 已修复（双重修复）
  - **问题 1**: `electron/main/oap.ts` 中 Token 以明文存储在 Electron Store
  - **修复 1**: 改用 `safeStorage.encryptString()` 加密
  - **问题 2**: MCP Host 将 token 明文写入 `oap_config.json`
  - **修复 2**: 改为通过 `ATTACKTRACE_OAP_TOKEN` 环境变量注入，仅保存在内存中
  - 影响：所有登录用户的云端账户可被窃取
  - **最终方案**: 
    - Electron 主进程：使用 safeStorage 加密存储
    - MCP Host：从环境变量读取，不持久化到磁盘
    - 跨平台支持：macOS Keychain / Windows DPAPI / Linux Secret Service (有条件)

- [x] **MCP Host 无认证机制** ✅ 已修复
  - 问题：`localhost:9527` API 完全无认证，任何本地进程可访问
  - 修复：实现共享密钥认证或改用 Unix Domain Socket
  - 影响：恶意软件可读取会话、调用工具、窃取配置
  - **修复方案**：生成随机 token 通过环境变量传递给 MCP Host，添加 AuthMiddleware 验证 X-Auth-Token header

### 数据传输
- [x] **WebSocket 可能明文传输** ✅ 已修复
  - 问题：`electron/main/oap.ts` 存在 `ws://` 降级逻辑
  - 修复：强制所有云端通信使用 `wss://` + TLS 1.3
  - 影响：Token 和消息可被中间人劫持
  - **修复方案**：强制 wss:// 连接，仅允许 localhost 使用 ws://

---

## 🟠 P1 - 高风险（2周内修复）

### 审计与监控
- [ ] **缺少操作审计日志**
  - 缺失：凭证访问、工具调用、配置变更、数据导出
  - 影响：无法溯源安全事件，不符合 SOC 2/ISO 27001

### 访问控制
- [ ] **CORS 配置过于宽松**
  - 问题：`mcp-host/httpd/app.py` 可配置为 `allow_origins=["*"]`
  - 修复：限制为仅 Desktop App origin

- [ ] **缺少 CSRF 保护**
  - 问题：MCP Host API 无 CSRF Token
  - 修复：实现 CSRF Token 验证机制

### 输入验证
- [ ] **用户输入缺少充分验证**
  - 风险：命令注入、路径遍历、XSS
  - 修复：实现统一的输入验证层

---

## 🟡 P2 - 中风险（1个月内修复）

### Token 管理
- [x] **Token 无过期和刷新机制** ✅ 已修复
  - **修复日期**：2026-02-12
  - **实现内容**：
    - Hub 端：JWT Token 有效期 7 天，Refresh Token 30 天
    - Desktop 端：自动检测 Token 过期（1小时缓冲），使用 Refresh Token 自动续期
    - 实现 Token 轮换机制（每次刷新生成新的 Refresh Token）
  - **相关文件**：
    - `electron/main/oap.ts` - Token 过期检测、自动刷新、Refresh Token 存储
    - `AttackTraceHub/src/routes/auth.js` - Refresh Token 接口和轮换机制

### 防护措施
- [ ] **MCP Host API 无速率限制**
  - 风险：本地 DoS 攻击
  - 修复：实现 API 速率限制（每分钟请求数）

- [ ] **依赖安全扫描**
  - 缺失：定期扫描 npm/PyPI 包漏洞
  - 修复：集成 Snyk 或 Dependabot 到 CI/CD

### 日志安全
- [ ] **日志可能包含敏感信息**
  - 问题：调试日志记录凭证元数据
  - 修复：实现日志脱敏和分级机制

---

## 📋 后续规划

### 企业级功能（Q2 2026）
- [ ] SSO 集成（SAML/OIDC）
- [ ] RBAC 细粒度权限控制
- [ ] Write 操作审批流程
- [ ] 端到端加密（E2EE）
- [ ] 安全合规报告（SOC 2/ISO 27001）

### 安全开发流程
- [ ] 制定安全编码规范
- [ ] 引入 SAST/DAST 工具
- [ ] 建立漏洞披露计划
- [ ] 定期渗透测试

---

## 🎯 本周重点（Week 1-2）

**目标：解决 3 个 P0 问题** ✅ 已完成

1. ✅ 加密 OAP Token 存储（已完成）
2. ✅ MCP Host 认证机制（已完成）
3. ✅ 强制 WebSocket TLS（已完成）

**✅ P0 问题已全部修复，可准备发布安全更新版本 v0.2.0**

---

## 🎯 Week 2 紧急修复（2026-02-12）

**目标：修复关键安全漏洞** ✅ 已完成

1. ✅ **移除硬编码密钥 'newmind'**（已完成）
   - Hub 端：移除密码解密逻辑
   - 前端：停止客户端加密，直接通过 HTTPS 传输
   - 安全影响：消除了最严重的安全漏洞

2. ✅ **实现 Token 过期和刷新机制**（已完成）
   - Desktop 端：自动检测 Token 过期（每 30 分钟检查）
   - 实现自动刷新机制（过期前 1 小时触发）
   - 支持 Refresh Token 轮换（Token Rotation）

**✅ 紧急安全修复完成，建议尽快发布 v0.2.1 补丁版本**

3. ✅ **实现数据库字段加密**（已完成）
   - 使用纯 Python 实现（cryptography + Fernet）
   - 无需外部系统依赖（无需 SQLCipher）
   - 加密密钥存储在系统 Keychain
   - 数据库文件权限自动设置为 600（仅所有者可读写）
   - 打包后开箱即用，无需用户手动安装

### 修复详情

#### 1. OAP Token 加密存储
- **文件**: `electron/main/oap.ts`
- **实现**: 使用 `safeStorage.encryptString()` 加密 token，使用系统原生密钥存储
- **存储格式**: Base64 编码的加密 buffer
- **系统支持**: macOS Keychain, Windows DPAPI, Linux Secret Service

#### 2. MCP Host 认证
- **文件**: 
  - `electron/main/service.ts` - 生成并传递认证 token
  - `mcp-host/attacktrace_mcp_host/httpd/middlewares/auth.py` - 认证中间件
  - `mcp-host/attacktrace_mcp_host/httpd/app.py` - 集成中间件
- **实现**: 启动时生成 64 字符随机 token，通过环境变量传递，HTTP header 验证
- **Header**: `X-Auth-Token`
- **前端**: 所有 API 调用自动注入认证 header

#### 3. 强制 WebSocket TLS
- **文件**: `electron/main/oap.ts`
- **实现**: 强制 wss:// 连接，仅允许 localhost 开发环境使用 ws://
- **安全检查**: 如果非 localhost 使用 ws:// 将抛出异常

#### 4. OAP Token 环境变量注入（新增）
- **文件**: 
  - `electron/main/service.ts` - 启动时注入 `ATTACKTRACE_OAP_TOKEN`
  - `mcp-host/attacktrace_mcp_host/oap_plugin/config_mcp_servers.py` - 从环境变量读取
  - `mcp-host/attacktrace_mcp_host/oap_plugin/models.py` - 配置模型
- **实现**: 
  - Electron 启动 MCP Host 时，从加密存储读取 token 并通过环境变量传递
  - MCP Host 仅在内存中保存 token，不写入任何配置文件
  - 运行时更新（登录/刷新）仅更新内存，不持久化
- **安全优势**: 
  - Token 不出现在文件系统（备份、日志、恢复时不泄露）
  - 进程重启后必须重新注入（限制了 token 生命周期）
  - 外部进程无法通过读文件获取 token

#### 5. 硬编码密钥移除（新增 - 2026-02-12）
- **文件**：
  - `AttackTraceHub/src/routes/auth.js` - 移除密码解密逻辑
  - `AttackTraceHub/frontend/src/contexts/AuthContext.jsx` - 停止客户端加密
- **修复前问题**：
  - 密码使用硬编码密钥 `'newmind'` 进行 AES 加密
  - 任何人都可以解密传输的密码（安全剧场）
  - 严重违反 PCI-DSS 标准
- **修复方案**：
  - 完全移除客户端密码加密
  - 密码明文通过 HTTPS 传输（安全且符合标准）
  - 服务端继续使用 bcrypt 哈希存储
- **安全影响**：消除最严重的安全漏洞（P0 级别）

#### 6. 数据库字段加密（新增 - 2026-02-12）
- **文件**：
  - `mcp-host/attacktrace_mcp_host/httpd/database/encryption.py` - 加密管理（新文件）
  - `mcp-host/attacktrace_mcp_host/httpd/server.py` - 数据库安全设置
  - `mcp-host/pyproject.toml` - 添加 cryptography 依赖
- **实现方案**：
  - **应用层加密**：使用 Fernet (AES-128) 加密敏感字段
  - **纯 Python**：使用 `cryptography` 库，无需 SQLCipher
  - **密钥管理**：存储在系统 Keychain（macOS/Windows/Linux）
  - **文件权限**：数据库文件自动设置为 600（仅所有者访问）
- **安全优势**：
  - 跨平台开箱即用（无需用户安装任何东西）
  - 密钥永不存储在文件中
  - 支持未来的敏感字段加密（如嵌入向量、工具配置）
  - 电脑被盗后，即使有数据库文件也无法解密（需要 Keychain 访问）

#### 7. Token 过期和自动刷新（新增 - 2026-02-12）
- **文件**：
  - `electron/main/oap.ts` - Token 管理和自动刷新
  - `AttackTraceHub/src/routes/auth.js` - Refresh Token 接口
- **实现内容**：
  - **Token 过期检测**：解码 JWT，检查 `exp` 字段，每 30 分钟检查一次
  - **自动刷新**：Token 过期前 1 小时自动调用 `/api/auth/refresh`
  - **Token 轮换**：每次刷新生成新的 Access Token 和 Refresh Token
  - **Refresh Token 存储**：使用 `safeStorage` 加密存储，与 Access Token 相同安全级别
- **安全优势**：
  - 限制 Token 生命周期（7 天 Access Token，30 天 Refresh Token）
  - 自动续期，用户无感知
  - Token 轮换减少重放攻击风险
  - 设备丢失后，Token 会在 30 天内自动失效

---

## 🖥️ 跨平台兼容性

### macOS ✅
- **加密后端**: Keychain（系统原生）
- **环境变量**: 完全支持
- **状态**: 生产就绪

### Windows ✅
- **加密后端**: DPAPI (Data Protection API)
- **环境变量**: 完全支持
- **状态**: 生产就绪

### Linux ⚠️
- **加密后端**: libsecret / Secret Service API
- **系统依赖**: 
  - GNOME 桌面: `gnome-keyring`（通常预装）
  - KDE 桌面: `kwallet`（通常预装）
  - 服务器/最小化环境: 可能**不可用**
- **兼容性检查**: `safeStorage.isEncryptionAvailable()` 返回 `false` 时，当前会回退到旧的明文 token
- **状态**: 桌面环境生产就绪，服务器环境需额外配置

#### Linux 特殊说明（文档必读）

**用户文档需包含以下内容**:

1. **桌面用户（GNOME/KDE）**: 无需额外配置，开箱即用
2. **服务器/容器用户**: 需要安装并运行 Secret Service
   ```bash
   # Ubuntu/Debian
   sudo apt install gnome-keyring libsecret-1-0
   
   # 启动 keyring daemon (需要 D-Bus)
   dbus-run-session -- sh -c 'gnome-keyring-daemon --unlock'
   ```
3. **Docker/Headless 环境**: 
   - 如果无法安装 Secret Service，应用会降级到旧的存储方式（安全性降低）
   - 建议仅在测试环境使用，生产环境应确保 Secret Service 可用
4. **验证加密是否可用**: 
   - 应用启动日志会显示 `[Security] Encryption not available` 如果加密不可用
   - 可在设置中查看"系统信息"确认加密状态

#### 降级行为（当 Secret Service 不可用时）

- ⚠️ Token 会回退到 Electron Store 的明文存储（`store.get("token")`）
- ⚠️ 安全级别显著降低（文件权限保护 vs 系统级加密）
- ⚠️ 建议用户在此环境下不要登录云端账户

**后续改进建议**:
- 在 Linux 无加密环境下，显示明确的安全警告弹窗
- 考虑实现基于密码的自定义加密方案（让用户输入主密码）
