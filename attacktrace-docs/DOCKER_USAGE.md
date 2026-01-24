# AttackTrace 文档 Docker 部署指南

## 📦 镜像信息

- **镜像名称**: `attacktrace-docs:1.0`
- **镜像文件**: `attacktrace-docs-1.0.tar` (约 84MB)
- **基于版本**: AttackTrace 1.0.0
- **访问端口**: 8001

---

## 🚀 快速启动

### 方式一：使用 Docker Compose（推荐）

```bash
# 1. 进入项目目录
cd /path/to/n8n-docs

# 2. 启动服务
docker-compose up

# 3. 访问文档
# 浏览器打开：http://localhost:8001
```

**停止服务**：
```bash
docker-compose down
```

---

### 方式二：从 tar 文件导入镜像

如果你收到了 `attacktrace-docs-1.0.tar` 文件：

```bash
# 1. 导入镜像
docker load -i attacktrace-docs-1.0.tar

# 2. 验证镜像已导入
docker images | grep attacktrace-docs

# 3. 运行容器
docker run -d \
  --name attacktrace-docs \
  -p 8001:8001 \
  attacktrace-docs:1.0

# 4. 访问文档
# 浏览器打开：http://localhost:8001
```

**查看日志**：
```bash
docker logs -f attacktrace-docs
```

**停止容器**：
```bash
docker stop attacktrace-docs
docker rm attacktrace-docs
```

---

### 方式三：直接构建镜像

如果你有源代码：

```bash
# 1. 进入项目目录
cd /path/to/n8n-docs

# 2. 构建镜像
docker build -t attacktrace-docs:1.0 .

# 3. 运行容器
docker run -d \
  --name attacktrace-docs \
  -p 8001:8001 \
  attacktrace-docs:1.0
```

---

## 🔧 高级配置

### 自定义端口

如果 8001 端口被占用，可以映射到其他端口：

```bash
# 映射到 9000 端口
docker run -d \
  --name attacktrace-docs \
  -p 9000:8001 \
  attacktrace-docs:1.0

# 访问地址：http://localhost:9000
```

### 后台运行并自动重启

```bash
docker run -d \
  --name attacktrace-docs \
  --restart=unless-stopped \
  -p 8001:8001 \
  attacktrace-docs:1.0
```

### 挂载自定义内容（可选）

如果需要实时编辑文档：

```bash
docker run -d \
  --name attacktrace-docs \
  -p 8001:8001 \
  -v $(pwd)/docs:/docs/docs:ro \
  attacktrace-docs:1.0
```

---

## 📋 常用命令

```bash
# 查看运行中的容器
docker ps

# 停止容器
docker stop attacktrace-docs

# 启动已停止的容器
docker start attacktrace-docs

# 删除容器
docker rm attacktrace-docs

# 查看容器日志
docker logs attacktrace-docs

# 进入容器内部（调试用）
docker exec -it attacktrace-docs /bin/bash
```

---

## 💾 镜像分发

### 导出镜像

```bash
docker save -o attacktrace-docs-1.0.tar attacktrace-docs:1.0
```

### 传输到其他机器

```bash
# 使用 scp 传输
scp attacktrace-docs-1.0.tar user@remote-host:/path/to/destination

# 使用 U盘/网络共享
# 直接复制 attacktrace-docs-1.0.tar 文件
```

### 在其他机器上导入

```bash
docker load -i attacktrace-docs-1.0.tar
docker run -d --name attacktrace-docs -p 8001:8001 attacktrace-docs:1.0
```

---

## 🌐 生产环境部署

### 使用 Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name docs.example.com;

    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 持久化运行（Systemd）

创建 `/etc/systemd/system/attacktrace-docs.service`：

```ini
[Unit]
Description=AttackTrace Documentation
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker run -d \
  --name attacktrace-docs \
  --restart=unless-stopped \
  -p 8001:8001 \
  attacktrace-docs:1.0
ExecStop=/usr/bin/docker stop attacktrace-docs
ExecStop=/usr/bin/docker rm attacktrace-docs

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl enable attacktrace-docs
sudo systemctl start attacktrace-docs
sudo systemctl status attacktrace-docs
```

---

## ❓ 常见问题

### 1. 端口被占用

**错误信息**：`Bind for 0.0.0.0:8001 failed: port is already allocated`

**解决方案**：更换端口映射
```bash
docker run -d --name attacktrace-docs -p 9000:8001 attacktrace-docs:1.0
```

### 2. 容器名称冲突

**错误信息**：`The container name "/attacktrace-docs" is already in use`

**解决方案**：删除旧容器
```bash
docker rm -f attacktrace-docs
```

### 3. 镜像导入失败

**错误信息**：`Error loading image from attacktrace-docs-1.0.tar`

**解决方案**：检查文件完整性
```bash
# 验证 tar 文件
tar -tzf attacktrace-docs-1.0.tar > /dev/null && echo "文件完整" || echo "文件损坏"
```

---

## 📞 技术支持

如遇到部署问题，请联系 AttackTrace 服务提供商。

---

## 📝 版本信息

- **文档版本**: 1.112.0
- **Docker 镜像版本**: 1.0
- **最后更新**: 2025-10-20
