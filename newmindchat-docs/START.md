# NewmindChat 文档启动指南

本文档说明如何启动 NewmindChat 文档服务。

## 启动方式

支持三种启动方式：

1. **本地开发模式**（使用 uv）
2. **Docker Compose**
3. **Docker 镜像**

## 方式 1：本地开发模式

### 启动开发服务器

```bash
cd newmindchat-docs
uv run mkdocs serve -a 0.0.0.0:8002
```

### 访问文档

浏览器访问：http://localhost:8002

### 开发模式特性

- 自动重载：修改文件后自动刷新
- 实时预览：即时查看修改效果
- 错误提示：显示构建错误和警告

### 自定义端口

```bash
# 使用其他端口
uv run mkdocs serve -a 0.0.0.0:8080
```

## 方式 2：Docker Compose

### 快速启动

```bash
cd newmindchat-docs
./start-docker.sh
```

或直接使用 docker-compose：

```bash
docker-compose up --build
```

### 访问文档

浏览器访问：http://localhost:8002

### 停止服务

```bash
docker-compose down
```

### 查看日志

```bash
docker-compose logs -f
```

## 方式 3：使用 Docker 镜像

### 构建镜像

```bash
# 使用 Dockerfile 构建
docker build -t newmindchat-docs:1.0 .

# 或使用一键打包脚本
./build-docker-tar.sh
```

### 启动容器

```bash
docker run -d --name newmindchat-docs -p 8002:8002 newmindchat-docs:1.0
```

### 访问文档

浏览器访问：http://localhost:8002

### 管理容器

```bash
# 查看日志
docker logs newmindchat-docs

# 停止容器
docker stop newmindchat-docs

# 启动容器
docker start newmindchat-docs

# 删除容器
docker rm newmindchat-docs
```

## 使用 tar 包部署

### 导入镜像

```bash
docker load -i newmindchat-docs-1.0.tar
```

### 启动服务

```bash
docker run -d --name newmindchat-docs -p 8002:8002 newmindchat-docs:1.0
```

### 访问文档

浏览器访问：http://localhost:8002

## 端口配置

所有启动方式默认使用 **8002** 端口。

如需修改端口：

### 本地模式

```bash
uv run mkdocs serve -a 0.0.0.0:YOUR_PORT
```

### Docker 模式

```bash
docker run -d --name newmindchat-docs -p YOUR_PORT:8002 newmindchat-docs:1.0
```

### Docker Compose

修改 `docker-compose.yml`：

```yaml
ports:
  - "YOUR_PORT:8002"
```

## 常见问题

### 端口被占用

检查并停止占用端口的进程：

```bash
# 查看端口占用
lsof -i :8002

# 或使用其他端口启动
uv run mkdocs serve -a 0.0.0.0:8080
```

### Docker 镜像构建失败

清理并重新构建：

```bash
docker system prune -a
docker build -t newmindchat-docs:1.0 .
```

### 文档无法访问

检查服务状态：

```bash
# 本地模式：检查进程
ps aux | grep mkdocs

# Docker 模式：检查容器
docker ps
docker logs newmindchat-docs
```

## 生产部署

### 推荐配置

- 使用 Docker 镜像部署
- 配置反向代理（Nginx/Apache）
- 启用 HTTPS
- 设置域名访问

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name docs.yourdomain.com;

    location / {
        proxy_pass http://localhost:8002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 停止服务

### 本地模式

在终端按 `Ctrl + C` 停止服务。

### Docker Compose

```bash
docker-compose down
```

### Docker 容器

```bash
docker stop newmindchat-docs
```

## 下一步

- 查看 [BUILD.md](./BUILD.md) 了解构建配置
- 查看 [README.md](./README.md) 了解文档结构
- 查看 [DOCKER_USAGE.md](./DOCKER_USAGE.md) 了解详细 Docker 使用


