# Electron 端安全与稳定性修复清单

> 按优先级排序。P0 = 安全漏洞（上线前必须修）；P1 = 功能性缺陷（影响稳定性）；P2 = 加固建议（上线后迭代）。

---

## P0 — 安全漏洞（上线前必须修）

- [x] **`open-external-url` 无 URL 校验** (`electron/main/ipc/util.ts`)
  - 任何来自 renderer 的字符串直接传给 `shell.openExternal`，可打开 `file://`、`javascript:` 等危险 scheme
  - _Fix_: 校验 URL 必须以 `https://` 或 `http://` 开头才允许打开

- [x] **`project:*` IPC 接受 renderer 传来的 `hubUrl` 并附带 token 请求** (`electron/main/ipc/project.ts`)
  - `project:list/create/update/delete` 均从 renderer 取 `hubUrl`，用 OAP token 请求该 URL
  - 被劫持的 renderer 可将 token 发送到攻击者服务器
  - _Fix_: main 进程从 `OAP_ROOT_URL` 读取固定 Hub URL，所有 IPC handler 签名移除 hubUrl 参数

- [x] **`util:readLocalLogo` 路径穿越** (`electron/main/ipc/util.ts`)
  - `logoPath` 来自 renderer，直接用于 `fse.readFile`，可读取任意本地文件
  - _Fix_: 解析路径后确认其在 configDir / scriptsDir / appDir 范围内，否则拒绝

- [x] **`innerHTML` XSS** (`src/views/Drawer/IntegrationMarket.tsx`)
  - `selectedTool.name` 直接插入 `innerHTML`，工具名含 HTML 标签即可注入脚本
  - _Fix_: 改用 `document.createElement + textContent + replaceChildren`

- [x] **`webPreferences` 依赖 Electron 默认值** (`electron/main/index.ts`)
  - `contextIsolation` / `nodeIntegration` 被注释掉，靠框架默认行为，升级版本可能失效
  - _Fix_: 显式设置 `contextIsolation: true`、`nodeIntegration: false`、`webSecurity: true`、`allowRunningInsecureContent: false`

---

## P1 — 功能性缺陷（影响运行稳定性）

- [x] **`fse.watch` 从不清理，导致内存泄漏** (`electron/main/service.ts`)
  - 每次 host 重启都追加一个新 watcher，旧的从未关闭，导致多重回调和内存泄漏
  - _Fix_: `busWatcher` 变量保存引用，`cleanup()` 和每次 `startHostService()` 前调用 `busWatcher.close()`

- [x] **`restartHost` 无互斥锁，并发调用可启动多个 host 进程** (`electron/main/service.ts`)
  - 快速多次调用 `restartHost` 导致多个 mcp-host 进程并行启动
  - _Fix_: 加 `isRestarting` flag，重启期间直接返回错误；`finally` 块中重置

- [x] **`second-instance` handler 注册两次** (`electron/main/index.ts`)
  - deeplink 处理逻辑被触发两次，可能导致重复登录事件
  - _Fix_: 删除文件底部多余的 `app.on("second-instance")` 注册

- [x] **`promiseSpawn` timeout 未清理** (`electron/main/service.ts`)
  - 进程正常退出后 `setTimeout(reject)` 仍会触发，造成 unhandled rejection
  - _Fix_: 保存 `timeoutId`，在 `close` 和 `error` 回调中调用 `clearTimeout(timeoutId)`

- [x] **`mcp.install` deeplink 不校验 base64/JSON** (`src/App.tsx`)
  - `atob(data.config)` + `JSON.parse(...)` 无 try/catch，畸形 deeplink 直接白屏崩溃
  - _Fix_: 包裹 try/catch，校验 payload 结构，出错时通过 toast 提示而非白屏

- [x] **无 React ErrorBoundary** (`src/App.tsx` / `src/Root.tsx`)
  - 任何子组件渲染异常都会导致整个应用白屏，无任何降级 UI
  - _Fix_: 新增 `src/components/ErrorBoundary.tsx`，在 `main.tsx` 最外层包裹，显示"出错了/Reload"提示

---

## P2 — 加固建议（上线后迭代）

- [x] **preload 过度暴露通用 IPC** (`electron/preload/index.ts`)
  - `ipcRenderer.on/send/invoke` 全部透传给 renderer，任意 channel 均可调用
  - _Fix_: 添加 channel allowlist（前缀 + 精确名称），不在列表内的 invoke/on/off 调用被拦截并打印警告；移除 `send`

- [x] **`postMessage` 使用 `"*"` target origin** (`src/App.tsx`, `src/Root.tsx`)
  - 任何 origin 都能接收消息，攻击面扩大
  - _Fix_: 改为 `window.location.origin || "*"`

- [x] **`window.onmessage` 未校验 origin** (`shared/preload.js`)
  - 任意 origin 发送 `{ payload: "removeLoading" }` 都能触发 `removeLoading()`
  - _Fix_: 检查 `ev.origin === window.location.origin` 后再处理（`null` origin 兜底允许 file://）

- [x] **LLM IPC 打印部分 API Key** (`electron/main/ipc/llm.ts`)
  - `apiKey.substring(0, 10)` 被 log 到日志文件
  - _Fix_: 删除所有 `[DEBUG]` 日志，包含 apiKey 片段和完整 API 响应的 console.log

- [x] **deeplink token 通过 URL query 传递** (`electron/main/deeplink.ts`)
  - Login token 实际通过 URL path 传递（已安全），`mcp.install` config 通过 query 传递属于协议限制无法避免
  - _Fix_: 已通过 P0 的 open-external-url 校验 + P1-5 的 payload 校验覆盖防御

- [x] **`listenMcpApply` 回调类型错误** (`electron/preload/index.ts`)
  - 类型声明为 `(id: string) => void`，实际收到的是 `{ name: string, config: string }`
  - _Fix_: 更新为 `(data: { name: string; config: string }) => void`

- [x] **`process.env.NODE_ENV` 在 renderer 中使用** (`IntegrationMarket.tsx`)
  - Vite 项目应使用 `import.meta.env.DEV`
  - _Fix_: 替换为 `import.meta.env.DEV`
