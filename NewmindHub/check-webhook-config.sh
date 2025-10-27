#!/bin/bash

# Stripe Webhook 配置检查脚本
# 用于验证云环境部署时的 webhook 配置是否正确

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Stripe Webhook 配置检查工具${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${RED}❌ 错误: 未找到 .env 文件${NC}"
    echo -e "${YELLOW}💡 请先创建 .env 文件:${NC}"
    echo -e "   cp env.docker.example .env"
    exit 1
fi

echo -e "${GREEN}✅ .env 文件存在${NC}\n"

# 加载环境变量
source .env 2>/dev/null || true

# 检查必需的环境变量
echo -e "${BLUE}📋 检查环境变量配置...${NC}\n"

# 检查 PUBLIC_WEBHOOK_URL
if [ -z "$PUBLIC_WEBHOOK_URL" ]; then
    echo -e "${RED}❌ PUBLIC_WEBHOOK_URL 未设置${NC}"
    echo -e "${YELLOW}💡 请在 .env 中添加:${NC}"
    echo -e "   # 本地开发:"
    echo -e "   PUBLIC_WEBHOOK_URL=http://localhost:23000"
    echo -e "   # 云环境:"
    echo -e "   PUBLIC_WEBHOOK_URL=https://your-domain.com"
    echo ""
    HAS_ERROR=1
else
    echo -e "${GREEN}✅ PUBLIC_WEBHOOK_URL = ${PUBLIC_WEBHOOK_URL}${NC}"
    
    # 检查是否还在使用 localhost
    if [[ "$PUBLIC_WEBHOOK_URL" == *"localhost"* ]]; then
        echo -e "${YELLOW}⚠️  警告: 使用 localhost 地址${NC}"
        echo -e "${YELLOW}   这仅适用于本地开发环境${NC}"
        echo -e "${YELLOW}   云环境部署时必须改为公网域名或IP${NC}"
        echo ""
    fi
fi

# 检查 STRIPE_SECRET_KEY
if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo -e "${RED}❌ STRIPE_SECRET_KEY 未设置${NC}"
    HAS_ERROR=1
else
    # 检查是测试密钥还是生产密钥
    if [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
        echo -e "${GREEN}✅ STRIPE_SECRET_KEY = sk_test_*** (测试环境)${NC}"
    elif [[ "$STRIPE_SECRET_KEY" == sk_live_* ]]; then
        echo -e "${GREEN}✅ STRIPE_SECRET_KEY = sk_live_*** (生产环境)${NC}"
    else
        echo -e "${YELLOW}⚠️  STRIPE_SECRET_KEY 格式异常${NC}"
    fi
fi

# 检查 STRIPE_WEBHOOK_SECRET
if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
    echo -e "${RED}❌ STRIPE_WEBHOOK_SECRET 未设置${NC}"
    echo -e "${YELLOW}💡 请从 Stripe Dashboard 获取 webhook secret${NC}"
    HAS_ERROR=1
else
    if [[ "$STRIPE_WEBHOOK_SECRET" == whsec_* ]]; then
        echo -e "${GREEN}✅ STRIPE_WEBHOOK_SECRET = whsec_*** (已配置)${NC}"
    else
        echo -e "${YELLOW}⚠️  STRIPE_WEBHOOK_SECRET 格式异常（应以 whsec_ 开头）${NC}"
    fi
fi

echo ""

# 构建完整的 webhook URL
FULL_WEBHOOK_URL="${PUBLIC_WEBHOOK_URL}/api/v1/payment/webhook"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  配置摘要${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}完整的 Webhook URL:${NC}"
echo -e "  ${FULL_WEBHOOK_URL}\n"

# 判断部署环境
if [[ "$PUBLIC_WEBHOOK_URL" == *"localhost"* ]]; then
    echo -e "${YELLOW}📍 检测到: 本地开发环境${NC}\n"
    
    echo -e "${BLUE}后续步骤:${NC}"
    echo -e "  1. 启动 Docker 服务:"
    echo -e "     ${GREEN}./docker-deploy.sh up${NC}"
    echo -e ""
    echo -e "  2. 运行 Stripe CLI 监听器:"
    echo -e "     ${GREEN}./start-stripe-cli-local.sh${NC}"
    echo -e "     或"
    echo -e "     ${GREEN}./start-stripe-cli-docker.sh${NC}"
    echo -e ""
    echo -e "  3. 从终端输出复制 webhook secret (whsec_xxx)"
    echo -e ""
    echo -e "  4. 更新 .env 文件中的 STRIPE_WEBHOOK_SECRET"
    echo -e ""
    echo -e "  5. 重启后端服务:"
    echo -e "     ${GREEN}./docker-deploy.sh restart${NC}"
else
    echo -e "${GREEN}🌍 检测到: 云环境部署${NC}\n"
    
    if [ -z "$HAS_ERROR" ]; then
        echo -e "${GREEN}✅ 配置检查通过！${NC}\n"
    else
        echo -e "${RED}❌ 配置有错误，请修复后重试${NC}\n"
        exit 1
    fi
    
    echo -e "${BLUE}后续步骤:${NC}"
    echo -e "  1. 确保 Docker 服务已启动:"
    echo -e "     ${GREEN}./docker-deploy.sh up${NC}"
    echo -e ""
    echo -e "  2. 在 Stripe Dashboard 配置 Webhook:"
    echo -e "     ${YELLOW}https://dashboard.stripe.com/webhooks${NC}"
    echo -e ""
    echo -e "  3. 添加 Endpoint URL:"
    echo -e "     ${GREEN}${FULL_WEBHOOK_URL}${NC}"
    echo -e ""
    echo -e "  4. 选择以下事件:"
    echo -e "     ☑  checkout.session.completed"
    echo -e "     ☑  invoice.payment_succeeded"
    echo -e "     ☑  customer.subscription.deleted"
    echo -e "     ☑  payment_intent.payment_failed"
    echo -e ""
    echo -e "  5. 保存后，复制 'Signing secret' (whsec_xxx)"
    echo -e ""
    echo -e "  6. 更新 .env 文件:"
    echo -e "     ${GREEN}STRIPE_WEBHOOK_SECRET=whsec_从Dashboard复制的secret${NC}"
    echo -e ""
    echo -e "  7. 重启后端服务:"
    echo -e "     ${GREEN}./docker-deploy.sh restart${NC}"
    echo -e ""
    echo -e "  8. 在 Stripe Dashboard 发送测试 webhook 验证配置"
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 测试网络连接（仅云环境）
if [[ "$PUBLIC_WEBHOOK_URL" != *"localhost"* ]] && [ -z "$HAS_ERROR" ]; then
    echo -e "\n${BLUE}🔍 测试网络连接...${NC}\n"
    
    # 提取域名或IP
    WEBHOOK_HOST=$(echo "$PUBLIC_WEBHOOK_URL" | sed -e 's|^[^/]*//||' -e 's|/.*$||')
    
    # 测试 ping
    if ping -c 1 -W 2 "$WEBHOOK_HOST" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 网络可达: $WEBHOOK_HOST${NC}"
    else
        echo -e "${YELLOW}⚠️  无法 ping $WEBHOOK_HOST${NC}"
        echo -e "${YELLOW}   (某些服务器禁用 ICMP，这可能是正常的)${NC}"
    fi
    
    # 测试端口（如果配置了端口）
    if [[ "$PUBLIC_WEBHOOK_URL" == *:* ]] && [[ "$PUBLIC_WEBHOOK_URL" != https://* ]]; then
        PORT=$(echo "$PUBLIC_WEBHOOK_URL" | grep -oP ':\K[0-9]+')
        if [ ! -z "$PORT" ]; then
            echo -e "\n${BLUE}测试端口 $PORT...${NC}"
            if timeout 3 bash -c "echo >/dev/tcp/$WEBHOOK_HOST/$PORT" 2>/dev/null; then
                echo -e "${GREEN}✅ 端口 $PORT 可访问${NC}"
            else
                echo -e "${RED}❌ 端口 $PORT 无法访问${NC}"
                echo -e "${YELLOW}💡 请检查防火墙配置${NC}"
            fi
        fi
    fi
fi

echo -e "\n${GREEN}完成！${NC}"
echo -e "${YELLOW}详细配置指南: STRIPE_WEBHOOK_SETUP.md${NC}\n"

