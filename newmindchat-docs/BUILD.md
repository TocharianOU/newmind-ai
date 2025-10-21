# NewmindChat 文档构建指南

NewmindChat 用户文档基于 MkDocs Material 构建。

## 环境要求

### 必需软件

- **Python**: 3.8 或更高版本
- **uv**: Python 包管理器

### 安装 uv

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 pip
pip install uv
```

## 依赖安装

使用 uv 安装所有依赖：

```bash
cd newmindchat-docs
uv pip install -r requirements.txt
```

## 依赖说明

项目使用以下主要依赖（见 `requirements.txt`）：

- **mkdocs**: 静态站点生成器
- **mkdocs-material**: Material Design 主题
- **mkdocs-exclude**: 排除特定文件
- **mkdocs-glightbox**: 图片灯箱效果
- **mkdocs-llmstxt**: LLM 优化的文本输出
- **mkdocs-macros-plugin**: 宏和模板支持

## 文档结构

```
newmindchat-docs/
├── docs/                    # 文档源文件
│   ├── index.md            # 首页
│   ├── getting-started/    # 快速开始
│   ├── hub/                # Hub 相关
│   ├── features/           # 功能特性
│   ├── mcp-servers/        # MCP 服务器
│   ├── configuration/      # 配置指南
│   └── troubleshooting/    # 故障排除
├── mkdocs.yml              # MkDocs 配置
├── nav.yml                 # 导航配置
├── main.py                 # 自定义宏和函数
└── requirements.txt        # Python 依赖
```

## 配置文件

### mkdocs.yml

主配置文件，包含：
- 站点信息
- 主题配置
- 插件配置
- Markdown 扩展

### nav.yml

导航结构配置，定义文档菜单层级。

## 构建文档

### 构建静态站点

```bash
mkdocs build
```

构建产物输出到 `site/` 目录。

### 验证构建

```bash
# 检查构建产物
ls -la site/

# 验证主要文件
cat site/index.html
```

## Docker 构建

### 构建 Docker 镜像

```bash
docker build -t newmindchat-docs:1.0 .
```

### 构建并导出 tar 包

```bash
./build-docker-tar.sh
```

这将创建 `newmindchat-docs-1.0.tar` 文件（约 84MB）。

## 常见问题

### uv 安装失败

使用 pip 作为备选：

```bash
pip install -r requirements.txt
```

### 构建错误

清理并重新构建：

```bash
rm -rf site/
mkdocs build
```

### 依赖冲突

使用虚拟环境隔离：

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# 或
.venv\Scripts\activate  # Windows

uv pip install -r requirements.txt
```

## 下一步

查看 [START.md](./START.md) 了解如何启动开发服务器。

