#!/bin/bash

# 后台运行 Stripe Webhook 监听
# 用于本地开发环境

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_URL="${1:-http://host.docker.internal:23000}"
WEBHOOK_URL="${BACKEND_URL}/api/v1/payment/webhook"

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep STRIPE_SECRET_KEY | xargs)
fi

if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo -e "${RED}❌ STRIPE_SECRET_KEY 未设置${NC}"
    exit 1
fi

# 步骤 1: 强制重新创建后端容器，确保环境变量生效
echo -e "${YELLOW}🔄 重新加载后端环境变量...${NC}"
docker-compose up -d --force-recreate backend > /dev/null 2>&1
echo -e "${GREEN}✅ 后端已重新加载${NC}\n"

# 步骤 2: 检查是否已运行
if docker ps | grep -q stripe-webhook; then
    echo -e "${YELLOW}⚠️  Stripe webhook 监听器已在运行${NC}"
    echo -e "${YELLOW}停止现有的监听器? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        docker stop stripe-webhook
        docker rm stripe-webhook
    else
        exit 0
    fi
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  启动 Stripe Webhook 监听（后台运行）${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}配置:${NC}"
echo -e "  Webhook URL: ${GREEN}${WEBHOOK_URL}${NC}\n"

# 后台运行 Docker 容器
docker run -d --name stripe-webhook \
    --restart unless-stopped \
    -e STRIPE_API_KEY="${STRIPE_SECRET_KEY}" \
    stripe/stripe-cli:latest listen \
    --forward-to "${WEBHOOK_URL}" \
    --events checkout.session.completed,invoice.payment_succeeded,customer.subscription.deleted,payment_intent.payment_failed \
    > /dev/null 2>&1

sleep 2

if docker ps | grep -q stripe-webhook; then
    echo -e "${GREEN}✅ Stripe webhook 监听器已启动（后台运行）${NC}\n"
    
    echo -e "${YELLOW}管理命令:${NC}"
    echo -e "  查看日志: ${GREEN}docker logs -f stripe-webhook${NC}"
    echo -e "  停止监听: ${GREEN}docker stop stripe-webhook${NC}"
    echo -e "  删除容器: ${GREEN}docker rm stripe-webhook${NC}"
    echo -e ""
else
    echo -e "${RED}❌ 启动失败${NC}"
    exit 1
fi

