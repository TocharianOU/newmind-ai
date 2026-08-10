#!/bin/bash

# OAP Hub 一键部署脚本
# 用法: bash deploy.sh          # 构建并启动（幂等，可重复运行）
#       bash deploy.sh --stop   # 停止
#       bash deploy.sh --logs   # 查看日志

set -e

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

# ---------- 子命令 ----------
case "${1:-}" in
    --stop)
        docker compose down
        echo -e "${GREEN}✅ 已停止${NC}"
        exit 0
        ;;
    --logs)
        docker compose logs -f --tail=100
        exit 0
        ;;
esac

echo "🚀 OAP Hub 一键部署"
echo "===================================="

# ---------- 0. 前置检查 ----------
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行，请先启动 Docker Desktop${NC}"
    exit 1
fi

# ---------- 1. 生成 .env（已存在则不覆盖）----------
if [ ! -f ".env" ]; then
    if [ ! -f "env.copy" ]; then
        echo -e "${RED}❌ 缺少 env.copy 模板${NC}"
        exit 1
    fi
    cp env.copy .env
    # 密钥留空时自动生成随机值
    if grep -q '^JWT_SECRET=$' .env; then
        sed -i '' "s/^JWT_SECRET=$/JWT_SECRET=$(openssl rand -hex 32)/" .env 2>/dev/null || \
        sed -i "s/^JWT_SECRET=$/JWT_SECRET=$(openssl rand -hex 32)/" .env
    fi
    if grep -q '^OAP_AUTH_TOKEN=$' .env; then
        sed -i '' "s/^OAP_AUTH_TOKEN=$/OAP_AUTH_TOKEN=$(openssl rand -hex 32)/" .env 2>/dev/null || \
        sed -i "s/^OAP_AUTH_TOKEN=$/OAP_AUTH_TOKEN=$(openssl rand -hex 32)/" .env
    fi
    echo -e "${GREEN}✅ 已从 env.copy 生成 .env（密钥已随机生成）${NC}"
else
    echo "ℹ️  .env 已存在，跳过生成"
fi

# 读取端口配置
PORT=$(grep '^PORT=' .env | cut -d= -f2)
PORT=${PORT:-23000}

# ---------- 2. 端口冲突处理（桌面版 NewChat 占用 23000 的情况）----------
if lsof -ti :"$PORT" >/dev/null 2>&1; then
    OCCUPIER=$(ps -p "$(lsof -ti :"$PORT" | head -1)" -o comm= 2>/dev/null || echo "未知进程")
    if echo "$OCCUPIER" | grep -qi "NewChat"; then
        echo -e "${YELLOW}⚠️  端口 $PORT 被桌面版 NewChat 占用，正在退出它...${NC}"
        osascript -e 'quit app "NewChat"' 2>/dev/null || true
        sleep 3
    fi
    if lsof -ti :"$PORT" >/dev/null 2>&1; then
        echo -e "${RED}❌ 端口 $PORT 仍被占用（$OCCUPIER），请释放后重试${NC}"
        exit 1
    fi
fi

# ---------- 3. 数据卷（幂等）----------
docker volume create oaphub_postgres_data >/dev/null
docker volume create oaphub_mcp_data >/dev/null
echo -e "${GREEN}✅ 数据卷就绪${NC}"

# ---------- 4. 构建并启动 ----------
echo "📦 构建镜像（首次约 5-10 分钟）..."
docker compose build
echo "🚀 启动服务..."
docker compose up -d

# ---------- 5. 等待就绪 ----------
echo "⏳ 等待 Hub 就绪..."
for i in $(seq 1 60); do
    if curl -sf "http://localhost:${PORT}/app/" >/dev/null 2>&1 || \
       curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/app/" 2>/dev/null | grep -q "200\|301\|302"; then
        break
    fi
    sleep 3
    if [ "$i" = "60" ]; then
        echo -e "${YELLOW}⚠️  等待超时，请检查日志: bash deploy.sh --logs${NC}"
        exit 1
    fi
done

# ---------- 6. 完成 ----------
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2)
echo ""
echo "============================================================"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo "============================================================"
echo "  💬 聊天应用:  http://localhost:${PORT}/app/"
echo "  🎛  管理后台:  http://localhost:${PORT}/console/"
echo "  🔐 管理员:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}"
echo ""
echo "  常用命令:"
echo "    bash deploy.sh --logs   查看日志"
echo "    bash deploy.sh --stop   停止服务"
echo "============================================================"
