#!/bin/bash

# 客户离线部署包打包脚本
# 产出: downloads/oaphub-docker-<arch>.tar.gz (+ .sha256)
# 包内容: 预构建镜像 images.tar + 离线 compose + env.copy + install.sh + DEPLOY.md
# 用法: bash build-package.sh          # 打当前架构的包 (Apple Silicon → arm64)
#       打完的包直接出现在 downloads/，Home 页面即刻显示为可下载
# 跨架构: 在 x86_64 机器上跑一次即得 x86_64 包（或用 docker buildx --platform）

set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; NC='\033[0m'

VERSION=$(node -p "require('../package.json').version" 2>/dev/null || echo "3.0.0")
ARCH=$(uname -m)
case "$ARCH" in
    arm64|aarch64) ARCH="arm64" ;;
    x86_64|amd64)  ARCH="x86_64" ;;
esac
PKG_NAME="oaphub-docker-${ARCH}"
STAGE_DIR="$(mktemp -d)/${PKG_NAME}"
trap 'rm -rf "$(dirname "$STAGE_DIR")"' EXIT
mkdir -p "$STAGE_DIR" downloads

echo "📦 打包 ${PKG_NAME} (版本 ${VERSION})"
echo "===================================="

# 1. 构建镜像
echo "🔨 构建镜像..."
docker compose build

# 2. 打版本 tag 并导出
echo "💾 导出镜像 (hub + mcp-host + postgres)..."
docker tag oaphub-hub "oaphub-hub:${VERSION}"
docker tag oaphub-mcp-host "oaphub-mcp-host:${VERSION}"
docker pull postgres:16-alpine --quiet 2>/dev/null || true
docker save -o "$STAGE_DIR/images.tar" \
    "oaphub-hub:${VERSION}" \
    "oaphub-mcp-host:${VERSION}" \
    postgres:16-alpine

# 3. 生成离线 compose（用预构建镜像，不再从源码 build）
cat > "$STAGE_DIR/docker-compose.yml" <<EOF
# NewMind AI — OAP Hub 离线部署 (预构建镜像, ${ARCH}, v${VERSION})
name: oaphub

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB:       attacktrace
      POSTGRES_USER:     postgres
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  mcp-host:
    image: oaphub-mcp-host:${VERSION}
    restart: unless-stopped
    environment:
      OAP_AUTH_TOKEN: \${OAP_AUTH_TOKEN}
      HUB_INTERNAL_URL: http://hub:3000
      HUB_EXTERNAL_PORT: \${PORT:-23000}
    volumes:
      - mcp_data:/app/data

  hub:
    image: oaphub-hub:${VERSION}
    restart: unless-stopped
    ports:
      - "\${PORT:-23000}:3000"
    environment:
      DATABASE_URL:            postgresql://postgres:\${POSTGRES_PASSWORD}@postgres:5432/attacktrace
      JWT_SECRET:              \${JWT_SECRET}
      MCP_HOST_URL:            http://mcp-host:61990
      MCP_HOST_INTERNAL_TOKEN: \${OAP_AUTH_TOKEN}
      NODE_ENV:                production
      ADMIN_EMAIL:             \${ADMIN_EMAIL:-}
      ADMIN_PASSWORD:          \${ADMIN_PASSWORD:-}
      DEPLOYMENT_MODE:         \${DEPLOYMENT_MODE:-enterprise}
      SSO_ENABLED:             \${SSO_ENABLED:-false}
      BILLING_ENABLED:         \${BILLING_ENABLED:-false}
      INVITE_CODE_ENABLED:     \${INVITE_CODE_ENABLED:-false}
      LICENSE_ENABLED:         \${LICENSE_ENABLED:-false}
      FORCE_HTTPS:             \${FORCE_HTTPS:-false}
      ALLOWED_ORIGINS:         \${ALLOWED_ORIGINS:-}
      HUB_FRONTEND_URL:        \${HUB_FRONTEND_URL:-}
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
  mcp_data:
EOF

# 4. 客户侧一键安装脚本
cat > "$STAGE_DIR/install.sh" <<'EOF'
#!/bin/bash
# NewMind AI 离线一键安装
set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker 未运行，请先安装并启动 Docker"; exit 1
fi

echo "📦 导入镜像..."
docker load -i images.tar

if [ ! -f ".env" ]; then
    cp env.copy .env
    if grep -q '^JWT_SECRET=$' .env; then
        sed -i.bak "s/^JWT_SECRET=$/JWT_SECRET=$(openssl rand -hex 32)/" .env && rm -f .env.bak
    fi
    if grep -q '^OAP_AUTH_TOKEN=$' .env; then
        sed -i.bak "s/^OAP_AUTH_TOKEN=$/OAP_AUTH_TOKEN=$(openssl rand -hex 32)/" .env && rm -f .env.bak
    fi
    echo "✅ 已生成 .env（密钥随机生成，密码请及时修改）"
fi

echo "🚀 启动服务..."
docker compose up -d

PORT=$(grep '^PORT=' .env | cut -d= -f2); PORT=${PORT:-23000}
echo ""
echo "🎉 安装完成！"
echo "  💬 聊天应用:  http://localhost:${PORT}/app/"
echo "  🎛  管理后台:  http://localhost:${PORT}/console/"
echo "  🔐 管理员:    见 .env 中的 ADMIN_EMAIL / ADMIN_PASSWORD"
EOF
chmod +x "$STAGE_DIR/install.sh"

# 5. 附带配置模板和文档
cp env.copy DEPLOY.md "$STAGE_DIR/"

# 6. 压缩 + 校验和 → downloads/
# 校验和用标准 "hash  文件名" 格式（仅 basename），使客户可直接 sha256sum -c 校验
echo "🗜  压缩..."
OUT="downloads/${PKG_NAME}.tar.gz"
tar -czf "$OUT" -C "$(dirname "$STAGE_DIR")" "$PKG_NAME"
( cd downloads && { shasum -a 256 "${PKG_NAME}.tar.gz" 2>/dev/null || sha256sum "${PKG_NAME}.tar.gz"; } > "${PKG_NAME}.tar.gz.sha256" )

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo -e "${GREEN}🎉 打包完成: ${OUT} (${SIZE})${NC}"
echo "   校验和: ${OUT}.sha256"
echo "   Home 页面现在应显示该包为可下载状态"
echo "   发布到线上: scp ${OUT}* 服务器:/path/to/oaphub/downloads/"
