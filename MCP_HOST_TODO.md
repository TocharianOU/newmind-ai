# mcp-host 安全与稳定性修复清单

> P0 = 上线前必须修；P1 = 高风险功能性问题；P2 = 加固建议

---

## P0 — 严重安全漏洞（上线前必须修）

- [x] **认证绕过：`access-control-request-method` 头可跳过所有认证** (`httpd/middlewares/auth.py` L47-48)
  - 任何非 OPTIONS 请求只需添加此 header 即可完全绕过 token 校验
  - _Fix_: 删除 `or request.headers.get("access-control-request-method")` 分支，仅对 `OPTIONS` 放行

- [x] **Auth token 前缀写入日志** (`httpd/middlewares/auth.py` L40)
  - `self.auth_token[:8]` 每次启动都打印到 INFO 日志
  - _Fix_: 只输出 "Auth middleware enabled"，不含 token 任何内容

- [x] **`/docs`/`/openapi.json`/`/redoc` 永久免认证** (`httpd/middlewares/auth.py` L16-21)
  - 任何人无需 token 可枚举所有 API、入参结构和错误信息
  - _Fix_: 通过环境变量 `DISABLE_DOCS=true` 在生产环境关闭，或从 PUBLIC_ENDPOINTS 中删除

- [x] **`x_project_id` header 路径穿越** (`httpd/conf/project_context.py` L85-95)
  - renderer 传入的 `X-Project-ID` 直接拼接到文件路径，`../../etc` 可逃出应用目录
  - _Fix_: 对 `project_id` 做 `^[a-zA-Z0-9_\-]{1,64}$` 正则校验，不符合则 400

- [x] **完整进程环境变量（含 API Key）记录到日志** (`host/tools/local_http_server.py` L54)
  - `logger.error("env: %s", env)` 把所有环境变量（包括 OPENAI_API_KEY 等）写入日志
  - _Fix_: 删除该行

- [x] **MCP 消息完整内容记录到 INFO 日志** (`host/tools/mcp_server.py` L208-213)
  - 每条 MCP 协议消息（含工具调用结果、上下文）都以 INFO 级别持久化
  - _Fix_: 移除 `content: %s` 字段，只记录消息类型

- [x] **SSRF：OAP plugin `save_file()` 读取任意本地文件** (`oap_plugin/store.py` L63-72)
  - `file` 为字符串时直接 `Path(file).open("rb")` 上传，可读取 `~/.ssh/id_rsa` 等
  - _Fix_: 若 `file` 为字符串路径，校验路径在允许目录内（缓存目录）

- [x] **SSRF：OAP device token 随请求转发到任意 URL** (`oap_plugin/instance_manager.py` L157-161)
  - marketplace 返回的 `url` 未验证，token 可被发送到攻击者服务器
  - _Fix_: 校验 URL 必须以 `https://` 开头，或对比已知 OAP 域名白名单

- [x] **任意代码执行：plugin registry 从配置加载任意模块** (`plugins/registry.py` L282-290)
  - `import_module(plugin_info.module)` 配合可写的插件配置文件可执行任意 Python
  - _Fix_: 硬编码允许的插件模块白名单，不信任配置文件中的模块路径

- [x] **SSRF：package_manager `download_url` 无 scheme 校验** (`oap_plugin/package_manager.py` L190-192)
  - `httpx.AsyncClient.stream('GET', download_url)` 可访问内网 `169.254.169.254` 等
  - _Fix_: 校验 URL 必须以 `https://` 开头，并限制下载大小上限（如 500MB）

---

## P1 — 高风险功能性问题

- [x] **加密密钥存储失败时静默继续，重启后数据永久不可读** (`httpd/database/encryption.py` L54-57)
  - `_store_key_in_keychain()` 返回值未检查，失败时内存密钥丢失
  - _Fix_: 检查返回值，失败时 `CRITICAL` 日志并拒绝启动

- [x] **`decrypt()` 失败时静默返回密文原文** (`httpd/database/encryption.py` L92-100)
  - 密钥错误/篡改时把 Fernet token 字符串当作明文返回给客户端
  - _Fix_: 区分 `InvalidToken`（密钥不匹配/篡改）和未加密旧数据，分别处理

- [x] **`memory.py` 并发竞争：共享单例的 `_db_session` 被多请求覆写** (`httpd/routers/memory.py` L107...)
  - 并发请求 A/B 互相覆盖对方的数据库 session，可导致数据串扰
  - _Fix_: 将 `db_session` 作为参数传入各方法，不修改单例状态

- [ ] **chat 路由挂载两次，形成双入口** (`httpd/app.py` L64, L73)
  - `/api/chat/*` 和 `/api/v1/mcp/*` 都指向同一 router，任何安全补丁只修一处
  - _Fix_: 确认是否需要第二个挂载点，不需要则删除

- [ ] **`model_verify` 端点无用户级认证（SSRF + 无限制 LLM 调用）** (`httpd/routers/model_verify.py` L414, L438)
  - 有 token 的任何调用者都可以让服务端向任意 baseURL 发出请求
  - _Fix_: 添加 `Depends(get_attacktrace_user)` 用户认证依赖

- [ ] **`chat` 端点 `create`/`edit`/`abort` 无显式用户认证** (`httpd/routers/chat.py` L73, L151, L286)
  - `abort` 完全没有鉴权，任意 token 持有者可中止他人聊天
  - _Fix_: 所有写端点加 `Depends(get_attacktrace_user)` 并校验资源归属

- [ ] **sync import 无 payload 大小限制（数据库洪泛 DoS）** (`httpd/routers/sync.py` L223-294)
  - 一次 POST 可插入数百万行记录，耗尽磁盘空间
  - _Fix_: `chats: list[...] = Field(max_length=10000)`，`content` 加 `max_length`

- [ ] **tarball 解压未正确过滤（路径穿越）** (`oap_plugin/package_manager.py` L236-250)
  - 路径检查后仍调用 `tar.extractall(install_dir)` 不传 filtered member list
  - _Fix_: 构建过滤后的 members 列表，调用 `tar.extractall(install_dir, members=safe_members)`

- [ ] **OAP package_manager 无下载大小限制（磁盘耗尽）** (`oap_plugin/package_manager.py` L187-250)
  - _Fix_: 下载时累计字节数，超过阈值（如 500MB）时中止

- [ ] **SQLite URI path traversal via `unquote()` in checkpointer** (`host/helpers/checkpointer.py` L25-26)
  - URL decode 后的路径未做目录限制校验
  - _Fix_: resolve 后校验路径在 appDir 内

- [ ] **prompt injection：MCP tool name/description 无转义直接插入系统 prompt** (`host/prompt.py` L33-34)
  - 恶意 MCP server 可通过工具名注入指令覆盖系统提示
  - _Fix_: 对 `tool.name` 和 `tool.description` 做 XML 转义

---

## P2 — 加固建议

- [ ] **CORS 默认回落到 `"*"`** (`httpd/app.py` L48)
  - _Fix_: 无配置时默认 `http://localhost` 而非 `*`

- [ ] **rate_limiter.py 完全为空** (`httpd/rate_limiter.py`)
  - _Fix_: 用 `slowapi` 对 `/api/chat`、`/api/sync`、`/v1/openai` 添加速率限制

- [ ] **MCP server `SecretStr` header 序列化为明文写入磁盘** (`httpd/conf/mcp_servers.py` L67-70)
  - _Fix_: 写盘时只保留 `@keychain:` 引用，不展开 secret 值

- [ ] **全量 `os.environ` 传给每个 MCP 子进程** (`host/tools/mcp_server.py` L446-447)
  - _Fix_: 从空 dict 开始，只注入 `config.env` + 必要的 PATH/系统变量白名单

- [ ] **TLS 校验禁用时无警告日志** (`host/conf/llm.py` L136-141)
  - _Fix_: 添加 `logger.warning("TLS verification disabled for provider %s", ...)`

- [ ] **`sync.py` message role 无枚举约束** (`httpd/routers/sync.py` L71)
  - _Fix_: `role: Literal["user", "assistant", "tool", "system"]`

- [ ] **`since` 参数未验证为 ISO-8601 格式** (`httpd/routers/sync.py` L116)
  - _Fix_: `datetime.fromisoformat(since)` 验证，失败返回 422

- [ ] **`encryption_managers` 全局 dict 非线程安全** (`httpd/database/encryption.py` L259-273)
  - _Fix_: 改用 `dict.setdefault()` 或加 asyncio Lock

- [ ] **`assert` 用于运行时校验（-O 模式下无效）** (多处)
  - _Fix_: 替换为 `if not x: raise ValueError(...)`

- [ ] **`DIVE_CUSTOM_RULES_CONTENT` 环境变量可注入任意系统 prompt** (`httpd/conf/prompt.py` L136-138)
  - _Fix_: 生产环境禁止此环境变量，或对内容做长度限制

- [ ] **`plugins.py` callback() 调用两次，第二实例未注册** (`httpd/routers/plugins.py` L35-36)
  - _Fix_: 调用一次并复用

- [ ] **`local_http_server.py` 无法保证子进程绑定 127.0.0.1** (`host/tools/local_http_server.py`)
  - _Fix_: 文档化要求，或在 `config.url` 校验中要求 hostname 为 127.0.0.1/localhost

- [ ] **server.py 迁移失败后继续启动** (`httpd/database/migrate.py`)
  - _Fix_: 迁移失败时中止进程，不继续 yield

- [ ] **keychain service/account 名称碰撞（`-` 和 `_` 视为相同）** (`httpd/conf/keychain.py` L75-78)
  - _Fix_: 只将非 `[a-zA-Z0-9]` 字符拒绝，不做替换
