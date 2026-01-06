#!/bin/bash

# MySQL MCP Server - Build ARM64 & AMD64 Docker images and export

set -e

VERSION=$(node -p "require('./package.json').version")
IMAGE_NAME="newmind-mcp-mysql"

echo "🔨 Building MySQL MCP Server Docker images"
echo "Version: ${VERSION}"
echo ""

# Check if TypeScript is built
if [ ! -d "dist" ]; then
    echo "⚠️  Building TypeScript..."
    npm run build
fi

# Build ARM64
echo "📦 Building ARM64 image..."
docker buildx build --platform linux/arm64 --tag ${IMAGE_NAME}:${VERSION}-arm64 --load .
echo "💾 Exporting ARM64 tar..."
docker save ${IMAGE_NAME}:${VERSION}-arm64 -o ${IMAGE_NAME}-${VERSION}-arm64.tar
echo "✅ ARM64: $(du -h ${IMAGE_NAME}-${VERSION}-arm64.tar | cut -f1)"

# Build AMD64
echo ""
echo "📦 Building AMD64 image..."
docker buildx build --platform linux/amd64 --tag ${IMAGE_NAME}:${VERSION}-amd64 --load .
echo "💾 Exporting AMD64 tar..."
docker save ${IMAGE_NAME}:${VERSION}-amd64 -o ${IMAGE_NAME}-${VERSION}-amd64.tar
echo "✅ AMD64: $(du -h ${IMAGE_NAME}-${VERSION}-amd64.tar | cut -f1)"

echo ""
echo "🎉 Complete! Generated files:"
ls -lh ${IMAGE_NAME}-${VERSION}-*.tar





















