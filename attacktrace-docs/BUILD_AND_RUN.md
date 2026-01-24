# AttackTrace 文档 Docker 打包和启动命令

## 📦 第一步：构建 Docker 镜像

```bash
cd /Users/ablatazmat/Downloads/n8n-docs
docker build -t attacktrace-docs:1.0 .
```

## 💾 第二步：导出为 tar 包

```bash
docker save -o attacktrace-docs-1.0.tar attacktrace-docs:1.0
```

## 🚀 第三步：启动容器

### 方式 1：直接运行（推荐）
```bash
docker run -d --name attacktrace-docs -p 8001:8001 attacktrace-docs:1.0
```

### 方式 2：使用 Docker Compose
```bash
docker-compose up -d
```

## 🌐 访问文档

浏览器打开：http://localhost:8001

---

## 📤 传输到其他机器

### 1. 在当前机器导出
```bash
docker save -o attacktrace-docs-1.0.tar attacktrace-docs:1.0
```

### 2. 传输文件（选择一种方式）
```bash
# 使用 scp
scp attacktrace-docs-1.0.tar user@remote-host:/path/to/destination

# 或使用 U盘/网络共享直接复制
```

### 3. 在目标机器导入和运行
```bash
# 导入镜像
docker load -i attacktrace-docs-1.0.tar

# 运行容器
docker run -d --name attacktrace-docs -p 8001:8001 attacktrace-docs:1.0

# 访问
# 浏览器打开：http://localhost:8001
```

---

## 🔧 常用管理命令

```bash
# 查看运行状态
docker ps

# 查看日志
docker logs -f attacktrace-docs

# 停止容器
docker stop attacktrace-docs

# 启动已停止的容器
docker start attacktrace-docs

# 重启容器
docker restart attacktrace-docs

# 删除容器
docker rm -f attacktrace-docs

# 删除镜像
docker rmi attacktrace-docs:1.0
```

---

## 🎯 一键脚本（复制粘贴即可）

### 本地构建、打包、启动
```bash
cd /Users/ablatazmat/Downloads/n8n-docs && \
docker build -t attacktrace-docs:1.0 . && \
docker save -o attacktrace-docs-1.0.tar attacktrace-docs:1.0 && \
docker run -d --name attacktrace-docs -p 8001:8001 attacktrace-docs:1.0 && \
echo "✅ 构建完成！访问 http://localhost:8001"
```

### 从 tar 导入并启动（其他机器用）
```bash
docker load -i attacktrace-docs-1.0.tar && \
docker run -d --name attacktrace-docs -p 8001:8001 attacktrace-docs:1.0 && \
echo "✅ 启动完成！访问 http://localhost:8001"
```
