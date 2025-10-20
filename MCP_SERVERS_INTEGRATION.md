# MCP Servers 集成文档

本文档记录了将 `mcp-server-kibana` 和 `mcp-server-elasticsearch-sl` 集成到 Dive AI 项目中的完整过程和相关代码修改。

## 📋 目录

- [概述](#概述)
- [集成的 MCP 服务器](#集成的-mcp-服务器)
- [项目结构](#项目结构)
- [核心代码修改](#核心代码修改)
- [配置说明](#配置说明)
- [部署流程](#部署流程)
- [常见问题](#常见问题)

---

## 概述

### 集成策略

我们采用了**单体仓库（Monorepo）+ NPM 隔离**的策略：

- **源码管理**：MCP 服务器源码纳入主项目 Git 仓库
- **依赖隔离**：每个 MCP 服务器保持独立的 `node_modules`
- **自动部署**：应用启动时自动复制预构建版本到用户数据目录

### 集成优势

1. ✅ **版本统一**：MCP 服务器版本与应用版本同步
2. ✅ **依赖隔离**：避免依赖冲突
3. ✅ **开箱即用**：用户无需手动安装
4. ✅ **自动更新**：应用更新时自动更新 MCP 服务器

---

## 集成的 MCP 服务器

### 1. mcp-server-kibana

**版本**: 0.4.1

**功能**: Kibana MCP Server - 用于 Elasticsearch 数据分析和可视化

**仓库**: https://github.com/TocharianOU/mcp-server-kibana

**环境变量**:
- `KIBANA_URL`: Kibana 服务器地址
- `KIBANA_USERNAME`: Kibana 用户名
- `KIBANA_PASSWORD`: Kibana 密码

**特性**:
- 惰性连接：即使未配置也能返回工具列表
- 支持多 Space
- 完整的 Kibana API 集成

---

### 2. mcp-server-elasticsearch-sl

**版本**: 0.2.0

**功能**: Elasticsearch MCP Server - 专注于安全和威胁分析

**特性**:
- 惰性连接：即使未连接也能返回工具列表
- 移除了许可检查（License Check）
- 支持多种认证方式（API Key、用户名密码）

**环境变量**:
- `ES_URL`: Elasticsearch 服务器地址
- `ES_API_KEY`: API Key（可选）
- `ES_USERNAME`: 用户名（可选）
- `ES_PASSWORD`: 密码（可选）
- `ES_CA_CERT`: CA 证书路径（可选）
- `NODE_TLS_REJECT_UNAUTHORIZED`: TLS 验证开关

**修改内容**:
- 移除了 `_hiddenCheck` 函数及相关许可验证代码
- 实现了惰性客户端初始化模式

---

## 项目结构

```
newmind-ai/
├── prebuilt/
│   └── scripts/
│       ├── mcp-server-echo/                 # Echo 测试服务器
│       │   ├── dist/                        # 编译后的代码
│       │   ├── node_modules/                # 独立依赖
│       │   ├── src/                         # 源代码
│       │   ├── package.json
│       │   ├── package-lock.json
│       │   └── tsconfig.json
│       ├── mcp-server-kibana/               # Kibana MCP 服务器
│       │   ├── dist/                        # 编译后的代码
│       │   ├── node_modules/                # 独立依赖
│       │   ├── package.json
│       │   ├── package-lock.json
│       │   └── ...
│       └── mcp-server-elasticsearch-sl/     # Elasticsearch MCP 服务器
│           ├── dist/                        # 编译后的代码
│           ├── node_modules/                # 独立依赖
│           ├── package.json
│           ├── package-lock.json
│           └── ...
│
├── electron/main/
│   ├── constant.ts                          # 常量定义（包含默认配置）
│   └── service.ts                           # 服务管理（包含迁移逻辑）
│
├── package.json                             # 主项目配置
└── .gitignore                               # Git 忽略规则
```

---

## 核心代码修改

### 1. electron/main/constant.ts

定义了 MCP 服务器的默认配置：

```typescript
import { app } from "electron"
import path from "node:path"
import os from "node:os"
import url from "node:url"

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

export { __dirname }

export const homeDir = os.homedir()
export const appDir = path.join(homeDir, ".dive")
export const scriptsDir = path.join(appDir, "scripts")
export const configDir = app.isPackaged ? path.join(appDir, "config") : path.join(process.cwd(), ".config")
export const hostCacheDir = path.join(appDir, "host_cache")
export const logDir = path.join(appDir, "log")

export const envPath = {
  root: VITE_DEV_SERVER_URL ? path.join(__dirname, "..", "..") : path.join(__dirname, "..", "..", ".."),
  log: logDir,
}

// 默认 MCP 服务器配置
export const DEF_MCP_SERVER_CONFIG = {
  "mcpServers": {
    "echo": {
      "enabled": true,
      "command": "node",
      "args": [
        path.join(scriptsDir, "mcp-server-echo", "dist", "index.js")
      ]
    },
    "kibana": {
      "enabled": false,
      "command": "node",
      "args": [
        path.join(scriptsDir, "mcp-server-kibana", "dist", "index.js")
      ],
      "env": {
        "KIBANA_URL": "",
        "KIBANA_USERNAME": "",
        "KIBANA_PASSWORD": ""
      }
    },
    "elasticsearch-sl": {
      "enabled": false,
      "command": "node",
      "args": [
        path.join(scriptsDir, "mcp-server-elasticsearch-sl", "dist", "index.js")
      ],
      "env": {
        "ES_URL": "",
        "ES_API_KEY": "",
        "ES_USERNAME": "",
        "ES_PASSWORD": "",
        "ES_CA_CERT": "",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}

// 默认 HTTPD 配置（SQLite）
const dbPath = path.join(configDir, "db.sqlite")
export const DEF_DIVE_HTTPD_CONFIG = {
  "db": {
    "uri": `sqlite:///${dbPath}`,
    "pool_size": 5,
    "pool_recycle": 60,
    "max_overflow": 10,
    "echo": false,
    "pool_pre_ping": true,
    "migrate": true
  },
  "checkpointer": {
    "uri": `sqlite:///${dbPath}`
  }
}

export const cwd = app.isPackaged ? path.join(__dirname, "../..") : process.cwd()
```

**关键点**：
- `scriptsDir`: 指向用户数据目录 `~/.dive/scripts`
- 默认配置中 `enabled: false`，需要用户手动启用
- 环境变量预留，用户需要填写实际值

---

### 2. electron/main/service.ts

#### 2.1 迁移脚本函数

```typescript
async function migratePrebuiltScripts() {
  const sourceDir = app.isPackaged
    ? path.join(process.resourcesPath, "prebuilt")
    : path.join(cwd, "prebuilt")

  const sourceScriptsDir = path.join(sourceDir, "scripts")

  // 确保目标目录存在
  await mkdirp(scriptsDir)

  console.log("=== Migrating prebuilt scripts ===")
  console.log("Source:", sourceScriptsDir)
  console.log("Target:", scriptsDir)

  const items = await fse.readdir(sourceScriptsDir)

  for (const item of items) {
    const sourcePath = path.join(sourceScriptsDir, item)
    const targetPath = path.join(scriptsDir, item)

    const stat = await fse.stat(sourcePath)

    if (item === "package.json" || item === "package-lock.json" || item.endsWith(".js")) {
      // 普通文件直接复制并替换
      await compareFilesAndReplace(sourcePath, targetPath)
      console.log(`Copied file: ${item}`)
    } else if (stat.isDirectory() && (item === "mcp-server-kibana" || item === "mcp-server-elasticsearch-sl")) {
      // MCP servers: 特殊处理
      console.log(`\n--- Processing MCP Server: ${item} ---`)

      // 检查目标目录是否存在 node_modules 和 dist
      const targetNodeModules = path.join(targetPath, "node_modules")
      const targetDist = path.join(targetPath, "dist")
      const hasNodeModules = await fse.pathExists(targetNodeModules)
      const hasDist = await fse.pathExists(targetDist)

      console.log(`  Target exists: ${await fse.pathExists(targetPath)}`)
      console.log(`  Has node_modules: ${hasNodeModules}`)
      console.log(`  Has dist: ${hasDist}`)

      if (!hasNodeModules || !hasDist) {
        // 如果缺少必要的目录，执行完全复制
        console.log(`  -> Full copy (missing dependencies or build)`)
        await fse.copy(sourcePath, targetPath, {
          overwrite: true,
          dereference: true,
          filter: (src) => {
            const relativePath = path.relative(sourcePath, src)
            // 排除源代码和开发文件，保留运行时需要的文件
            if (relativePath.includes('.git') ||
                relativePath === 'tsconfig.json' ||
                relativePath.startsWith('src/') ||
                relativePath === 'index.ts' ||
                relativePath === 'catalog-info.yaml' ||
                relativePath === 'renovate.json') {
              return false
            }
            return true
          }
        })
      } else {
        // 检查版本是否变化
        const sourcePackageJson = path.join(sourcePath, "package.json")
        const targetPackageJson = path.join(targetPath, "package.json")

        let shouldUpdate = false

        if (await fse.pathExists(sourcePackageJson) && await fse.pathExists(targetPackageJson)) {
          const sourceContent = await fse.readJSON(sourcePackageJson)
          const targetContent = await fse.readJSON(targetPackageJson)

          if (sourceContent.version !== targetContent.version) {
            console.log(`  Version changed: ${targetContent.version} -> ${sourceContent.version}`)
            shouldUpdate = true
          } else {
            console.log(`  Version unchanged: ${sourceContent.version}`)
          }
        }

        if (shouldUpdate) {
          console.log(`  -> Full copy (version update)`)
          await fse.copy(sourcePath, targetPath, {
            overwrite: true,
            dereference: true,
            filter: (src) => {
              const relativePath = path.relative(sourcePath, src)
              if (relativePath.includes('.git') ||
                  relativePath === 'tsconfig.json' ||
                  relativePath.startsWith('src/') ||
                  relativePath === 'index.ts' ||
                  relativePath === 'catalog-info.yaml' ||
                  relativePath === 'renovate.json') {
                return false
              }
              return true
            }
          })
        } else {
          console.log(`  -> Skipping (already up to date)`)
        }
      }

      console.log(`--- Finished: ${item} ---\n`)
    }
  }

  // 清理旧的 echo.cjs 文件（如果存在）
  const oldEchoCjs = path.join(scriptsDir, "echo.cjs")
  if (await fse.pathExists(oldEchoCjs)) {
    await fse.unlink(path.join(scriptsDir, "echo.cjs"))
  }
}
```

**迁移逻辑说明**：

1. **普通文件**（`echo.js`, `package.json`）：直接复制并替换
2. **MCP 服务器目录**：
   - 首次安装：完整复制（包括 `node_modules` 和 `dist`）
   - 版本更新：检测 `package.json` 版本，如有变化则完整复制
   - 版本不变：跳过复制，节省时间
3. **文件过滤**：排除 `.git`、`src/`、`tsconfig.json` 等开发文件

---

### 3. package.json

添加了构建和准备脚本：

```json
{
  "scripts": {
    "build:electron": "npm run build:mcp-kibana && npm run build:mcp-elasticsearch && npm run prepare:mcp-kibana && npm run prepare:mcp-elasticsearch && tsc -b && vite-node scripts/download-host-deps.ts && vite build --config vite.config.electron.ts",
    
    "prepare:mcp-kibana": "cd prebuilt/scripts/mcp-server-kibana && npm ci --omit=dev --ignore-scripts",
    "build:mcp-kibana": "cd prebuilt/scripts/mcp-server-kibana && npm install && npm run build",
    "clean:mcp-kibana": "cd prebuilt/scripts/mcp-server-kibana && rm -rf node_modules dist && npm cache clean --force",
    
    "prepare:mcp-elasticsearch": "cd prebuilt/scripts/mcp-server-elasticsearch-sl && npm ci --omit=dev --ignore-scripts",
    "build:mcp-elasticsearch": "cd prebuilt/scripts/mcp-server-elasticsearch-sl && npm install && npm run build",
    "clean:mcp-elasticsearch": "cd prebuilt/scripts/mcp-server-elasticsearch-sl && rm -rf node_modules dist && npm cache clean --force"
  }
}
```

**脚本说明**：
- `build:mcp-*`: 安装依赖并编译 TypeScript
- `prepare:mcp-*`: 只安装生产依赖，用于打包
- `clean:mcp-*`: 清理构建产物

---

### 4. .gitignore

```gitignore
# MCP Servers - keep source but ignore their git repos, node_modules and build output
prebuilt/scripts/mcp-server-*/node_modules/
prebuilt/scripts/mcp-server-*/.git/
prebuilt/scripts/mcp-server-*/dist/
```

**说明**：
- 保留源码：`.ts` 文件、`package.json` 等纳入版本控制
- 忽略构建产物：`node_modules/`、`dist/`、`.git/`

---

## 配置说明

### 用户配置文件位置

- **开发环境**: `<项目根目录>/.config/mcp_config.json`
- **生产环境**: `~/.dive/config/mcp_config.json`

### 配置示例

#### Kibana MCP Server

```json
{
  "mcpServers": {
    "kibana": {
      "enabled": true,
      "command": "node",
      "args": [
        "/Users/username/.dive/scripts/mcp-server-kibana/dist/index.js"
      ],
      "env": {
        "KIBANA_URL": "http://localhost:5601",
        "KIBANA_USERNAME": "elastic",
        "KIBANA_PASSWORD": "your_password"
      }
    }
  }
}
```

#### Elasticsearch MCP Server

```json
{
  "mcpServers": {
    "elasticsearch-sl": {
      "enabled": true,
      "command": "node",
      "args": [
        "/Users/username/.dive/scripts/mcp-server-elasticsearch-sl/dist/index.js"
      ],
      "env": {
        "ES_URL": "https://localhost:9200",
        "ES_USERNAME": "elastic",
        "ES_PASSWORD": "your_password",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

#### 使用 API Key（推荐）

```json
{
  "mcpServers": {
    "elasticsearch-sl": {
      "enabled": true,
      "command": "node",
      "args": [
        "/Users/username/.dive/scripts/mcp-server-elasticsearch-sl/dist/index.js"
      ],
      "env": {
        "ES_URL": "https://localhost:9200",
        "ES_API_KEY": "your_base64_api_key",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

---

## 部署流程

### 开发环境

1. **克隆项目**
   ```bash
   git clone <repository>
   cd newmind-ai
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建 MCP 服务器**
   ```bash
   npm run build:mcp-kibana
   npm run build:mcp-elasticsearch
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

### 生产环境（打包）

#### Mac

```bash
# 跳过代码签名和公证
CSC_IDENTITY_AUTO_DISCOVERY=false SKIP_NOTARIZATION=true npm run build:mac
```

#### Windows

```bash
npm run build:win
```

#### Linux

```bash
npm run build:linux
```

### 打包产物位置

```
release/
├── 0.0.1/
│   ├── Newmind Agent-electron-0.0.1-mac-arm64.dmg
│   ├── Newmind Agent-electron-0.0.1-mac-arm64.zip
│   ├── Newmind Agent-electron-0.0.1-mac-x64.dmg
│   └── Newmind Agent-electron-0.0.1-mac-x64.zip
```

---

## 常见问题

### Q1: Echo MCP 服务器报错 "Connection closed"

**原因**: `~/.dive/scripts/` 目录缺少 `node_modules`

**解决方案**:
```bash
cd ~/.dive/scripts && npm install
```

或者删除 `~/.dive/scripts` 目录，重启应用让它重新初始化。

---

### Q2: MCP 服务器未出现在工具列表

**可能原因**:
1. MCP 服务器未启用（`enabled: false`）
2. 环境变量未配置
3. 迁移失败

**解决方案**:
1. 检查 `~/.dive/config/mcp_config.json` 中的 `enabled` 字段
2. 填写正确的环境变量
3. 查看日志 `~/.dive/log/host/` 了解详细错误信息

---

### Q3: Elasticsearch 连接失败

**可能原因**:
1. URL 配置错误
2. 证书验证失败
3. 认证信息错误

**解决方案**:
1. 确认 `ES_URL` 格式正确（包括 `http://` 或 `https://`）
2. 如使用自签名证书，设置 `NODE_TLS_REJECT_UNAUTHORIZED=0`
3. 验证用户名密码或 API Key 是否正确

---

### Q4: 如何更新 MCP 服务器版本？

**步骤**:

1. 更新源码（在 `prebuilt/scripts/` 目录）
2. 修改 `package.json` 版本号
3. 重新构建
   ```bash
   npm run clean:mcp-kibana
   npm run build:mcp-kibana
   ```
4. 重启应用，迁移逻辑会自动更新用户目录

---

### Q5: 打包时遇到 TypeScript 错误

**常见错误**: `'process.stdout' is possibly 'null'`

**解决方案**: 已在代码中使用可选链操作符 `?.` 修复：
```typescript
process.stdout?.on("data", (data) => {
  log(data.toString())
})
```

---

### Q6: Mac 打包时 hdiutil 失败

**错误信息**: `unable to execute hdiutil`

**解决方案**:
```bash
# 强制卸载挂载的卷
hdiutil detach "/Volumes/Newmind Agent-0.0.1" -force

# 清理构建目录
rm -rf release/

# 重新打包
CSC_IDENTITY_AUTO_DISCOVERY=false SKIP_NOTARIZATION=true npm run build:mac
```

或者只打包 ZIP 格式：
```bash
npm run build:mac -- --mac zip
```

---

## 技术细节

### 惰性连接实现

两个 MCP 服务器都实现了惰性连接模式，即使没有连接到后端服务也能返回工具列表：

#### mcp-server-elasticsearch-sl 示例

```typescript
// 创建客户端工厂函数（惰性初始化）
function createElasticsearchClient(config: ElasticsearchConfig): Client {
  const validatedConfig = ConfigSchema.parse(config);
  const { url, apiKey, username, password, caCert } = validatedConfig;

  const clientOptions: ClientOptions = {
    node: url,
    maxRetries: 5,
    requestTimeout: 60000,
    compression: true
  };

  if (apiKey) {
    clientOptions.auth = { apiKey };
  } else if (username && password) {
    clientOptions.auth = { username, password };
  }

  if (caCert) {
    try {
      const ca = fs.readFileSync(caCert);
      clientOptions.tls = { ca };
    } catch (error) {
      console.error(`Failed to read certificate file: ${error}`);
    }
  }

  return new Client(clientOptions);
}

export async function createElasticsearchMcpServer(config: ElasticsearchConfig) {
  let esClient: Client | null = null;
  
  // 惰性客户端获取器
  const getClient = () => {
    if (!esClient) {
      esClient = createElasticsearchClient(config);
    }
    return esClient;
  };

  const server = new McpServer({
    name: "elasticsearch-mcp-server-js",
    version: "0.2.0",
  });

  // 工具定义 - 不需要客户端就能注册
  server.tool(
    "list_indices",
    "List all available Elasticsearch indices",
    {},
    async () => {
      try {
        const client = getClient(); // 在这里才创建客户端
        const response = await client.cat.indices({ format: "json" });
        // ... 处理响应 ...
      } catch (error) {
        // ... 错误处理 ...
      }
    }
  );

  return server;
}
```

**优势**:
- 启动快：不等待连接即可返回工具列表
- 用户友好：用户可以先看到可用工具，再配置连接
- 容错性强：即使配置错误，应用也不会崩溃

---

## 版本历史

### mcp-server-kibana

- **0.4.1** (当前版本)
  - 修复 TypeScript 编译错误（`skipLibCheck: true`）
  - 更新依赖版本

- **0.4.0**
  - 初始集成版本

### mcp-server-elasticsearch-sl

- **0.2.0** (当前版本)
  - 移除许可检查逻辑
  - 实现惰性客户端初始化
  - 更新 MCP SDK 到 1.18.2

---

## 贡献指南

### 添加新的 MCP 服务器

1. **将服务器源码放到 `prebuilt/scripts/` 目录**
2. **在 `constant.ts` 中添加默认配置**
3. **在 `service.ts` 的 `migratePrebuiltScripts` 中添加迁移逻辑**
4. **在 `package.json` 中添加构建脚本**
5. **更新 `.gitignore`**
6. **测试并提交**

### 代码规范

- 使用 TypeScript
- 遵循项目现有代码风格
- 添加必要的注释
- 更新相关文档

---

## 许可证

本项目遵循 Apache-2.0 许可证。

- `mcp-server-kibana`: Apache-2.0
- `mcp-server-elasticsearch-sl`: Apache-2.0

---

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。

---

**文档版本**: 1.0.0  
**最后更新**: 2025-10-05  
**维护者**: Dive AI Team

