#!/bin/bash

# Stripe CLI Docker 启动脚本
# 使用 Docker 运行 Stripe CLI，无需本地安装

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 加载环境变量
if [ -f .env ]; then
  export $(cat .env | grep STRIPE_SECRET_KEY | xargs)
fi

# 检查环境变量
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo -e "${RED}❌ 错误: STRIPE_SECRET_KEY 环境变量未设置${NC}"
  echo -e "${YELLOW}💡 请先在 .env 文件中设置 STRIPE_SECRET_KEY${NC}"
  exit 1
fi

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker 未运行${NC}"
  echo -e "${YELLOW}💡 请先启动 Docker Desktop${NC}"
  exit 1
fi

# 检查后端服务是否运行
echo -e "${YELLOW}🔍 检查后端服务...${NC}"
if ! curl -s http://localhost:23000/api/health > /dev/null 2>&1; then
  echo -e "${RED}❌ 后端服务未运行在 http://localhost:23000${NC}"
  echo -e "${YELLOW}💡 请先启动后端服务:${NC}"
  echo -e "   cd /Users/ablatazmat/Downloads/newmind-ai/NewmindHub"
  echo -e "   npm run dev"
  exit 1
fi

echo -e "${GREEN}✅ 后端服务正常运行${NC}\n"

# 清理可能存在的旧容器
docker rm -f stripe-cli > /dev/null 2>&1

# 获取本机 IP（用于 Docker 访问宿主机）
# 尝试 host.docker.internal（Docker Desktop 默认）
WEBHOOK_URL="http://host.docker.internal:23000/api/v1/payment/webhook"

# 启动 Stripe CLI
echo -e "${GREEN}🚀 启动 Stripe CLI Webhook 转发 (Docker)...${NC}"
echo -e "${YELLOW}📝 监听的事件:${NC}"
echo -e "   - checkout.session.completed"
echo -e "   - invoice.payment_succeeded"
echo -e "   - customer.subscription.deleted"
echo -e "   - payment_intent.payment_failed"
echo -e ""
echo -e "${YELLOW}🔗 转发目标: ${WEBHOOK_URL}${NC}"
echo -e ""
echo -e "${RED}⚠️  重要: 首次运行时，请复制输出的 webhook signing secret (whsec_...)${NC}"
echo -e "${RED}   并更新到 .env 文件中的 STRIPE_WEBHOOK_SECRET，然后重启后端${NC}"
echo -e ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 运行 Stripe CLI Docker 容器
docker run --rm -it --name stripe-cli \
  -e STRIPE_API_KEY="${STRIPE_SECRET_KEY}" \
  stripe/stripe-cli:latest listen \
  --forward-to "${WEBHOOK_URL}" \
  --print-secret \
  --events checkout.session.completed,invoice.payment_succeeded,customer.subscription.deleted,payment_intent.payment_failed

# 脚本结束后的清理提示
echo -e "\n${YELLOW}🛑 Stripe CLI 已停止${NC}"

