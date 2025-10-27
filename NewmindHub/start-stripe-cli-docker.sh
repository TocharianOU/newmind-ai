#!/bin/bash

# Stripe CLI Docker 启动脚本
# 使用 Docker 运行 Stripe CLI，支持本地和 LAN 地址测试

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Stripe CLI Docker 启动脚本${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    echo -e "${YELLOW}用法:${NC}"
    echo -e "  $0 [backend_url]"
    echo -e ""
    echo -e "${YELLOW}参数:${NC}"
    echo -e "  backend_url  - 后端服务完整地址 (默认: http://host.docker.internal:23000)"
    echo -e "                 格式: http://地址:端口"
    echo -e ""
    echo -e "${YELLOW}示例:${NC}"
    echo -e "  ${GREEN}# 本地 Docker 后端 (默认)${NC}"
    echo -e "  $0"
    echo -e ""
    echo -e "  ${GREEN}# LAN 地址测试${NC}"
    echo -e "  $0 http://192.168.1.100:23000"
    echo -e ""
    echo -e "  ${GREEN}# 使用域名${NC}"
    echo -e "  $0 https://hub.mydomain.com"
    echo -e ""
    exit 0
}

# 检查帮助参数
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
fi

# 参数解析 - 完整的 URL
BACKEND_URL="${1:-http://host.docker.internal:23000}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Stripe CLI Docker 启动脚本${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}配置:${NC}"
echo -e "  后端地址: ${GREEN}${BACKEND_URL}${NC}\n"

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

# 构建测试 URL 和 webhook URL
TEST_URL="${BACKEND_URL}/api/health"
WEBHOOK_URL="${BACKEND_URL}/api/v1/payment/webhook"

# 检查后端服务是否运行
echo -e "${YELLOW}🔍 检查后端服务...${NC}"
echo -e "   测试 URL: ${TEST_URL}"

if curl -s --connect-timeout 5 "${TEST_URL}" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 后端服务正常运行${NC}\n"
else
  echo -e "${RED}❌ 后端服务未运行或无法访问${NC}"
  echo -e "${YELLOW}💡 请确认:${NC}"
  echo -e "   1. 后端服务已启动"
  echo -e "   2. 地址可访问: ${BACKEND_URL}"
  echo -e "   3. 防火墙允许访问"
  echo -e ""
  echo -e "${YELLOW}提示:${NC}"
  echo -e "  如果使用 LAN 地址，请确保:"
  echo -e "  - 本机和目标设备在同一网络"
  echo -e "  - 目标设备的防火墙已开放端口"
  echo -e "  - 使用正确的 LAN IP 地址"
  echo -e ""
  exit 1
fi

# 清理可能存在的旧容器
docker rm -f stripe-cli > /dev/null 2>&1

# 启动 Stripe CLI
echo -e "${GREEN}🚀 启动 Stripe CLI Webhook 转发 (Docker)...${NC}"
echo -e "${YELLOW}📝 监听的事件:${NC}"
echo -e "   - checkout.session.completed"
echo -e "   - invoice.payment_succeeded"
echo -e "   - customer.subscription.deleted"
echo -e "   - payment_intent.payment_failed"
echo -e ""
echo -e "${YELLOW}🔗 转发目标:${NC}"
echo -e "   ${GREEN}${WEBHOOK_URL}${NC}"
echo -e ""
echo -e "${RED}⚠️  重要: 首次运行时，请复制输出的 webhook signing secret (whsec_...)${NC}"
echo -e "${RED}   并更新到 .env 文件中的 STRIPE_WEBHOOK_SECRET，然后重启后端${NC}"
echo -e ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 确定网络模式
# 对于 LAN 地址，不使用 host 网络，而是让容器直接访问
if [[ "$BACKEND_URL" == *"host.docker.internal"* ]]; then
  echo -e "${BLUE}ℹ️  使用 Docker 内部网络访问宿主机${NC}\n"
  NETWORK_ARGS=""
else
  echo -e "${BLUE}ℹ️  使用默认网络模式访问外部地址${NC}\n"
  NETWORK_ARGS=""
fi

# 运行 Stripe CLI Docker 容器
echo -e "${YELLOW}正在启动容器...${NC}"
echo -e "${BLUE}按 Ctrl+C 可以停止监听${NC}\n"

docker run --rm -it --name stripe-cli \
  ${NETWORK_ARGS} \
  -e STRIPE_API_KEY="${STRIPE_SECRET_KEY}" \
  stripe/stripe-cli:latest listen \
  --forward-to "${WEBHOOK_URL}" \
  --events checkout.session.completed,invoice.payment_succeeded,customer.subscription.deleted,payment_intent.payment_failed

# 检查退出状态
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ] && [ $EXIT_CODE -ne 130 ]; then
  echo -e "${RED}❌ Stripe CLI 异常退出 (退出码: $EXIT_CODE)${NC}"
  echo -e "${YELLOW}可能的原因:${NC}"
  echo -e "  - STRIPE_SECRET_KEY 无效"
  echo -e "  - 网络连接问题"
  echo -e "  - Webhook URL 无法访问"
fi

# 脚本结束后的清理提示
echo -e "\n${YELLOW}🛑 Stripe CLI 已停止${NC}"
echo -e ""
echo -e "${BLUE}提示: 如需再次运行，使用:${NC}"
if [[ "$1" != "" ]]; then
  echo -e "  ${GREEN}$0 $BACKEND_URL${NC}"
else
  echo -e "  ${GREEN}$0${NC}"
fi
echo -e ""

