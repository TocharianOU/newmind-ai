#!/bin/bash

# Stripe Webhook 自动配置脚本
# 用于本地开发环境自动配置 Stripe webhook

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Stripe Webhook 自动配置${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${RED}❌ 未找到 .env 文件${NC}"
    exit 1
fi

# 加载 STRIPE_SECRET_KEY
export $(cat .env | grep STRIPE_SECRET_KEY | xargs)

if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo -e "${RED}❌ STRIPE_SECRET_KEY 未设置${NC}"
    exit 1
fi

# 获取后端地址参数
BACKEND_URL="${1:-http://host.docker.internal:23000}"

echo -e "${YELLOW}配置:${NC}"
echo -e "  后端地址: ${GREEN}${BACKEND_URL}${NC}\n"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行${NC}"
    exit 1
fi

# 清理旧容器
docker rm -f stripe-cli-setup > /dev/null 2>&1 || true

WEBHOOK_URL="${BACKEND_URL}/api/v1/payment/webhook"

echo -e "${BLUE}🚀 获取 Stripe Webhook Secret...${NC}"
echo -e "${YELLOW}转发目标: ${WEBHOOK_URL}${NC}\n"

# 运行 Stripe CLI 获取 webhook secret
# 使用 timeout 让它运行5秒后自动退出
WEBHOOK_SECRET=$(docker run --rm --name stripe-cli-setup \
  -e STRIPE_API_KEY="${STRIPE_SECRET_KEY}" \
  stripe/stripe-cli:latest listen \
  --forward-to "${WEBHOOK_URL}" \
  --print-secret \
  --events checkout.session.completed 2>&1 | \
  grep -o "whsec_[a-zA-Z0-9]*" | head -1 &
  
  DOCKER_PID=$!
  sleep 3
  kill $DOCKER_PID 2>/dev/null || true
  wait $DOCKER_PID 2>/dev/null || true
)

if [ -z "$WEBHOOK_SECRET" ]; then
    echo -e "${RED}❌ 无法获取 webhook secret${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 获取到 Webhook Secret:${NC}"
echo -e "   ${YELLOW}${WEBHOOK_SECRET}${NC}\n"

# 更新 .env 文件
echo -e "${BLUE}📝 更新 .env 文件...${NC}"

if grep -q "^STRIPE_WEBHOOK_SECRET=" .env; then
    # 替换现有的
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=${WEBHOOK_SECRET}|" .env
    else
        # Linux
        sed -i "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=${WEBHOOK_SECRET}|" .env
    fi
else
    # 追加新的
    echo "STRIPE_WEBHOOK_SECRET=${WEBHOOK_SECRET}" >> .env
fi

echo -e "${GREEN}✅ .env 已更新${NC}\n"

# 重新加载后端（强制重新创建容器以加载新的环境变量）
echo -e "${BLUE}🔄 重新加载后端服务...${NC}"
docker-compose up -d --force-recreate backend > /dev/null 2>&1

echo -e "${GREEN}✅ 后端已重新加载${NC}\n"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Stripe Webhook 配置完成！${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}配置信息:${NC}"
echo -e "  Webhook Secret: ${GREEN}${WEBHOOK_SECRET}${NC}"
echo -e "  Webhook URL: ${GREEN}${WEBHOOK_URL}${NC}\n"

echo -e "${YELLOW}后续步骤:${NC}"
echo -e "  1. 在后台运行 Stripe CLI 转发:"
echo -e "     ${GREEN}./start-stripe-webhook.sh ${BACKEND_URL}${NC}"
echo -e ""
echo -e "  2. 或手动运行:"
echo -e "     ${GREEN}./start-stripe-cli-docker.sh ${BACKEND_URL}${NC}"
echo -e ""

