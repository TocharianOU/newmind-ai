#!/bin/bash

# AttackTrace 文档 Docker 镜像一键打包脚本
# 使用方法：./build-docker-tar.sh

set -e  # 遇到错误立即退出

echo "================================"
echo "AttackTrace 文档 Docker 打包工具"
echo "================================"
echo ""

# 定义变量
IMAGE_NAME="attacktrace-docs"
IMAGE_TAG="1.0"
TAR_FILE="attacktrace-docs-1.0.tar"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

# 1. 检查 Docker 是否运行
echo "📋 [1/5] 检查 Docker 环境..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ 错误：Docker 未运行，请先启动 Docker"
    exit 1
fi
echo "✅ Docker 运行正常"
echo ""

# 2. 清理旧文件
echo "🧹 [2/5] 清理旧文件..."
if [ -f "$TAR_FILE" ]; then
    echo "   删除旧的 tar 文件: $TAR_FILE"
    rm -f "$TAR_FILE"
fi

# 清理旧容器（如果存在）
if docker ps -a --format '{{.Names}}' | grep -q "^${IMAGE_NAME}$"; then
    echo "   停止并删除旧容器: $IMAGE_NAME"
    docker rm -f "$IMAGE_NAME" > /dev/null 2>&1 || true
fi

echo "✅ 清理完成"
echo ""

# 3. 构建 Docker 镜像
echo "🔨 [3/5] 构建 Docker 镜像..."
echo "   镜像名称: ${IMAGE_NAME}:${IMAGE_TAG}"
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .
if [ $? -eq 0 ]; then
    echo "✅ 镜像构建成功"
else
    echo "❌ 镜像构建失败"
    exit 1
fi
echo ""

# 4. 导出为 tar 文件
echo "💾 [4/5] 导出 Docker 镜像为 tar 文件..."
echo "   输出文件: $TAR_FILE"
docker save -o "$TAR_FILE" "${IMAGE_NAME}:${IMAGE_TAG}"
if [ $? -eq 0 ]; then
    echo "✅ 导出成功"
else
    echo "❌ 导出失败"
    exit 1
fi
echo ""

# 5. 显示结果
echo "📊 [5/5] 打包完成！"
echo ""
echo "================================"
echo "📦 打包结果"
echo "================================"
echo "镜像名称: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "tar 文件: $TAR_FILE"
echo "文件大小: $(ls -lh "$TAR_FILE" | awk '{print $5}')"
echo "文件路径: $SCRIPT_DIR/$TAR_FILE"
echo ""

# 显示镜像信息
echo "Docker 镜像信息:"
docker images | grep "$IMAGE_NAME" | head -1
echo ""

echo "================================"
echo "🚀 快速启动命令"
echo "================================"
echo ""
echo "# 本机启动容器："
echo "docker run -d --name attacktrace-docs -p 8002:8002 ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "# 在其他机器导入并启动："
echo "docker load -i $TAR_FILE"
echo "docker run -d --name attacktrace-docs -p 8002:8002 ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "# 访问地址："
echo "http://localhost:8002"
echo ""

echo "✅ 所有操作完成！"

