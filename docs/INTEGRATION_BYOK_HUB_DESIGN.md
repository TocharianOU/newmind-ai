# 集成凭证模式设计：BYOK vs Hub 托管

> 状态：设计讨论中  
> 背景：以 VirusTotal 为首个落地案例，建立可复用的集成凭证模式规范

---

## 一、问题背景

对于 VirusTotal、Shodan 等需要 API Key 的威胁情报类集成，存在两类用户需求：

- **有自己 Key 的用户**：企业已采购，希望直接用自己的额度
- **没有 Key 的用户**：希望开箱即用，由平台提供访问能力

---

## 二、架构决策

### 不采用：后端完整 MCP Server

后端部署一个完整的 VT MCP 实例（HTTP Streamable），客户端通过 transport 连接。

**放弃原因**：需要在后端维护 MCP 进程、session 管理、工具注册，复杂度高，与现有架构不一致。

### 采用：本地 MCP + 后端 API Proxy

```
[用户本地 VT MCP Server]
        ↓
   BYOK 模式：直接调用 virustotal.com
   Hub 模式：调用 our-backend.com/proxy/vt
        ↓
   [后端 Proxy]（仅 Hub 模式）
   验证 OAP Token → 注入平台 VT Key → 转发请求 → 记录用量
        ↓
   virustotal.com
```

**优点**：
- MCP 工具逻辑（7 个工具、schema、格式化）全部留在客户端，后端无状态
- 后端 Proxy 复用现有 model proxy 模式（30-50 行），无新系统
- VT API Key 永不下发到客户端
- BYOK / Hub 两种模式共用同一套 MCP Server 代码，仅 `baseURL` env 不同

---

## 三、VT MCP Server 改造要点

基于 `list_tool/mcp-virustotal`（fork 自 `@burtthecoder/mcp-virustotal`，已加 HTTP Streamable 支持）：

- `baseURL` 改为从 env 读取：`VIRUSTOTAL_BASE_URL`，默认仍为 `https://www.virustotal.com/api/v3`
- Hub 模式下，MCP Server 用 OAP token 鉴权，后端 Proxy 负责替换为真实 `x-apikey`
- BYOK 模式下，行为与原版完全一致

---

## 四、Marketplace 配置界面设计

### 配置页结构

同一个 VirusTotal 集成，配置时最顶部有凭证模式选择：

```
API Key 来源
  ○ Hub 托管（使用平台配额，无需配置）
  ● 自定义 Key（使用你自己的 API Key）
```

- 选 **Hub 托管**：表单消失，显示"平台将自动提供 API Key"，一键完成安装
- 选 **自定义 Key**：展示 `VIRUSTOTAL_API_KEY` 输入框，走本地 Keychain 存储

### 套餐门控

Hub 托管如为 PRO/ENTERPRISE 专属，BASE 用户看到：

```
○ Hub 托管  [PRO]  — 升级后解锁
```

不隐藏，保留转化引导。

### 已安装工具列表

| 模式 | 状态标签 |
|------|---------|
| 自定义 Key | `已安装 · 自有 Key` |
| Hub 托管 | `已安装 · Hub · PRO` |

### 用量展示（Hub 托管模式）

工具卡片显示本月配额消耗，例如：`已用 234 次 / 1000 次`

作用：
- 引导用户珍惜配额，避免滥用
- 接近上限时自然触发升级动作
- 消除超配额的惊讶感

---

## 五、后端 Proxy 职责（Hub 模式）

1. 验证请求携带的 OAP Bearer Token
2. 检查用户套餐权限与剩余配额
3. 将 `Authorization` header 替换为 `x-apikey: <平台VT_KEY>`
4. 透明转发请求至 `virustotal.com`
5. 写入 `UsageRecord`（按请求次数计量）

---

## 六、可复用性

本方案可作为**所有外部 API Key 类集成的通用模式**，适用场景包括：

- 威胁情报：VirusTotal、Shodan、AbuseIPDB
- 云平台：AWS（限定只读权限）
- 其他需要 key 但不宜暴露给客户端的服务

凡是符合"本地 MCP + 代理转发"结构的集成，均可复用本设计。
