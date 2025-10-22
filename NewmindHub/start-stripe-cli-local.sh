#!/bin/bash

# Stripe CLI 本地启动脚本（推荐方式）
# 需要先运行: stripe login

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Stripe CLI 是否已安装
if ! command -v stripe &> /dev/null; then
  echo -e "${RED}❌ 错误: Stripe CLI 未安装${NC}"
  echo -e "${YELLOW}💡 请先安装 Stripe CLI:${NC}"
  echo -e "   方法1: brew install stripe/stripe-cli/stripe"
  echo -e "   方法2: 下载二进制文件 https://github.com/stripe/stripe-cli/releases"
  exit 1
fi

# 检查是否已登录
if ! stripe config --list &> /dev/null; then
  echo -e "${YELLOW}⚠️  未登录 Stripe，正在启动登录...${NC}"
  stripe login
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

# 启动 Stripe CLI
echo -e "${GREEN}🚀 启动 Stripe CLI Webhook 监听...${NC}"
echo -e "${YELLOW}📝 监听的事件:${NC}"
echo -e "   - checkout.session.completed"
echo -e "   - invoice.payment_succeeded"
echo -e "   - customer.subscription.deleted"
echo -e "   - payment_intent.payment_failed"
echo -e ""
echo -e "${YELLOW}🔗 转发目标: http://localhost:23000/api/v1/payment/webhook${NC}"
echo -e ""
echo -e "${RED}⚠️  重要: 首次运行时，请复制输出的 webhook signing secret (whsec_...)${NC}"
echo -e "${RED}   并更新到 .env 文件中的 STRIPE_WEBHOOK_SECRET，然后重启后端${NC}"
echo -e ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 运行 Stripe CLI
stripe listen \
  --forward-to http://localhost:23000/api/v1/payment/webhook \
  --events checkout.session.completed,invoice.payment_succeeded,customer.subscription.deleted,payment_intent.payment_failed

# 脚本结束后的提示
echo -e "\n${YELLOW}🛑 Stripe CLI 已停止${NC}"

