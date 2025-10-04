# Newmind Agent

一个基于 Electron 的智能代理应用，集成了 Kibana MCP 服务器，支持 Elasticsearch 数据分析和可视化。

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8
- Git

### 安装和构建

#### 1. 克隆项目
```bash
git clone https://github.com/TocharianOU/newmind-ai.git
cd newmind-ai
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 构建 MCP Kibana 服务器
```bash
# 构建完整的 MCP Kibana 服务器（包含所有依赖）
npm run build:mcp-kibana

# 准备生产环境的 MCP Kibana（只保留生产依赖）
npm run prepare:mcp-kibana
```

#### 4. 构建主应用
```bash
npm run build:electron
```

### 开发模式

```bash
# 启动开发服务器（包含热重载）
npm run dev
```

### 生产模式

#### 方法一：直接运行构建后的应用
```bash
npm run build:electron
# 然后运行构建后的应用
./dist-electron/main/index.js
```

#### 方法二：打包成可执行文件

**macOS:**
```bash
# 打包所有架构
npm run package:darwin

# 或者分别打包
npm run package:darwin-dmg:arm64  # Apple Silicon
npm run package:darwin-dmg:x64    # Intel
```

**Windows:**
```bash
npm run package:windows
```

**Linux:**
```bash
npm run package:linux
```

## 📦 项目结构

```
newmind-ai/
├── electron/                 # Electron 主进程代码
│   ├── main/                # 主进程
│   └── preload/             # 预加载脚本
├── src/                     # 渲染进程代码（React）
├── prebuilt/scripts/        # 预构建的脚本
│   ├── echo.js             # 基础脚本
│   └── mcp-server-kibana/   # Kibana MCP 服务器
│       ├── dist/           # 构建输出
│       ├── node_modules/   # 独立依赖
│       ├── src/           # 源代码
│       └── package.json   # 独立配置
├── mcp-host/               # MCP 主机服务
└── scripts/               # 构建脚本
```

## 🔧 MCP Kibana 服务器

### 特性

- **完全独立**：包含所有必要的 Node.js 依赖
- **自动复制**：应用启动时自动复制到用户目录
- **版本控制**：支持版本检查和更新
- **多平台支持**：支持 macOS、Windows、Linux

### 配置

MCP Kibana 服务器通过以下配置连接：

```json
{
  "mcpServers": {
    "kibana": {
      "enabled": true,
      "command": "node",
      "args": ["~/.dive/scripts/mcp-server-kibana/dist/index.js"],
      "env": {
        "KIBANA_URL": "http://your-kibana-url:5601",
        "KIBANA_USERNAME": "your-username",
        "KIBANA_PASSWORD": "your-password"
      }
    }
  }
}
```

### 支持的操作

- **搜索 Kibana 对象**：搜索仪表板、可视化、索引模式等
- **获取对象详情**：获取特定对象的详细信息
- **创建对象**：创建新的 Kibana 对象
- **更新对象**：更新现有对象
- **删除对象**：删除不需要的对象
- **批量操作**：支持批量创建、更新、删除

## 🛠️ 开发指南

### 添加新的 MCP 服务器

1. **创建服务器目录**：
   ```bash
   mkdir prebuilt/scripts/your-mcp-server
   cd prebuilt/scripts/your-mcp-server
   ```

2. **初始化项目**：
   ```bash
   npm init -y
   # 添加必要的依赖
   npm install @modelcontextprotocol/sdk
   ```

3. **配置独立安装**：
   创建 `.npmrc` 文件：
   ```
   legacy-peer-deps=true
   install-links=false
   ```

4. **更新构建脚本**：
   在 `package.json` 中添加构建命令：
   ```json
   {
     "scripts": {
       "build:your-mcp": "cd prebuilt/scripts/your-mcp-server && npm install && npm run build",
       "prepare:your-mcp": "cd prebuilt/scripts/your-mcp-server && npm ci --omit=dev --ignore-scripts"
     }
   }
   ```

5. **更新复制逻辑**：
   在 `electron/main/service.ts` 中添加复制逻辑

### 构建脚本说明

- `build:mcp-kibana`：构建 MCP Kibana 服务器（开发依赖 + 生产依赖）
- `prepare:mcp-kibana`：准备生产环境（只保留生产依赖）
- `clean:mcp-kibana`：清理构建文件
- `build:electron`：构建主应用

## 📋 可用脚本

### 开发脚本
- `npm run dev`：启动开发服务器
- `npm run lint`：代码检查
- `npm run check`：类型检查

### 构建脚本
- `npm run build`：构建渲染进程
- `npm run build:electron`：构建 Electron 应用
- `npm run build:mcp-kibana`：构建 MCP Kibana 服务器
- `npm run prepare:mcp-kibana`：准备生产环境

### 打包脚本
- `npm run package:darwin`：打包 macOS 应用
- `npm run package:windows`：打包 Windows 应用
- `npm run package:linux`：打包 Linux 应用

### 清理脚本
- `npm run clean:mcp-kibana`：清理 MCP Kibana 构建文件

## 🔍 故障排除

### MCP 服务器无法启动

1. **检查依赖**：
   ```bash
   ls -la ~/.dive/scripts/mcp-server-kibana/node_modules/@modelcontextprotocol
   ```

2. **重新构建**：
   ```bash
   npm run clean:mcp-kibana
   npm run build:mcp-kibana
   npm run prepare:mcp-kibana
   ```

3. **检查日志**：
   查看应用日志中的错误信息

### 构建失败

1. **清理缓存**：
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **检查 Node.js 版本**：
   ```bash
   node --version  # 应该是 >= 18
   ```

## 📄 许可证

本项目采用 Apache-2.0 许可证。详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请通过以下方式联系：

- GitHub Issues: [https://github.com/TocharianOU/newmind-ai/issues](https://github.com/TocharianOU/newmind-ai/issues)
- 邮箱: [your-email@example.com]

---

**注意**：本项目集成了 Kibana MCP 服务器，需要有效的 Kibana 实例才能使用相关功能。