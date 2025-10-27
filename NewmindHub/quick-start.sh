#!/bin/bash

# NewmindHub 一键启动脚本
# 自动完成所有配置和启动流程

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  NewmindHub 一键启动${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，从模板创建...${NC}"
    cp env.docker.example .env
    echo -e "${GREEN}✅ .env 文件已创建${NC}\n"
    
    echo -e "${RED}⚠️  请先编辑 .env 文件配置必要的密钥！${NC}"
    echo -e "${YELLOW}至少需要配置:${NC}"
    echo -e "  - ANTHROPIC_API_KEY"
    echo -e "  - STRIPE_SECRET_KEY"
    echo -e "  - STRIPE_PUBLISHABLE_KEY"
    echo -e ""
    echo -e "${YELLOW}编辑完成后再次运行此脚本${NC}\n"
    exit 1
fi

# 确定后端 URL
BACKEND_URL="http://host.docker.internal:23000"
if [ ! -z "$1" ]; then
    BACKEND_URL="$1"
    echo -e "${YELLOW}使用自定义后端地址: ${BACKEND_URL}${NC}\n"
fi

# 步骤 1: 预先配置 Stripe Webhook Secret（关键！）
echo -e "${BLUE}[1/6] 预先配置 Stripe Webhook Secret...${NC}"
echo -e "${YELLOW}⚠️  重要：必须在启动容器前配置，否则环境变量不会生效！${NC}\n"

# 检查 .env 中是否已有 webhook secret
CURRENT_SECRET=$(grep "^STRIPE_WEBHOOK_SECRET=" .env | cut -d'=' -f2 || echo "")

if [[ -z "$CURRENT_SECRET" || "$CURRENT_SECRET" == "whsec_your_webhook_secret_here" ]]; then
    echo -e "${YELLOW}🔍 .env 中没有有效的 webhook secret，自动获取...${NC}"
    
    # 临时获取 webhook secret
    echo -e "${YELLOW}正在启动临时 Stripe CLI 容器...${NC}"
    TEMP_SECRET=$(docker run --rm stripe/stripe-cli:latest listen --print-secret 2>&1 | grep -o 'whsec_[a-zA-Z0-9]*' | head -1)
    
    if [[ ! -z "$TEMP_SECRET" ]]; then
        echo -e "${GREEN}✅ 获取到 Webhook Secret: ${TEMP_SECRET}${NC}"
        
        # 写入 .env
        if grep -q "^STRIPE_WEBHOOK_SECRET=" .env; then
            sed -i.bak "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=${TEMP_SECRET}|" .env
        else
            echo "STRIPE_WEBHOOK_SECRET=${TEMP_SECRET}" >> .env
        fi
        
        echo -e "${GREEN}✅ Webhook Secret 已写入 .env${NC}\n"
    else
        echo -e "${RED}❌ 无法获取 webhook secret${NC}"
        echo -e "${YELLOW}请手动配置 .env 中的 STRIPE_WEBHOOK_SECRET${NC}\n"
    fi
else
    echo -e "${GREEN}✅ .env 中已有 webhook secret: ${CURRENT_SECRET:0:20}...${NC}\n"
fi

# 步骤 2: 启动服务
echo -e "${BLUE}[2/6] 启动 Docker 服务...${NC}"
./docker-deploy.sh up
echo ""

# 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动（30秒）...${NC}"
sleep 30
echo ""

# 步骤 3: 初始化数据库
echo -e "${BLUE}[3/6] 初始化数据库...${NC}"
./docker-deploy.sh migrate
echo ""

# 步骤 4: 验证 Stripe 配置
echo -e "${BLUE}[4/6] 验证 Stripe 配置...${NC}"
LOADED_SECRET=$(docker-compose exec -T backend printenv STRIPE_WEBHOOK_SECRET 2>/dev/null || echo "")

if [[ ! -z "$LOADED_SECRET" && "$LOADED_SECRET" != "whsec_your_webhook_secret_here" ]]; then
    echo -e "${GREEN}✅ 后端已加载 webhook secret: ${LOADED_SECRET:0:20}...${NC}\n"
else
    echo -e "${RED}⚠️  警告：后端未正确加载 webhook secret${NC}"
    echo -e "${YELLOW}建议运行: ./docker-deploy.sh restart${NC}\n"
fi

# 步骤 5: 启动 Stripe webhook 监听
echo -e "${BLUE}[5/6] 启动 Stripe Webhook 监听...${NC}"
echo -e "${YELLOW}是否在后台启动 Stripe webhook 监听? (y/n)${NC}"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    chmod +x start-stripe-webhook.sh
    ./start-stripe-webhook.sh "$BACKEND_URL"
else
    echo -e "${YELLOW}⏭️  跳过启动 webhook 监听${NC}"
    echo -e "${YELLOW}稍后可运行: ./start-stripe-webhook.sh ${BACKEND_URL}${NC}\n"
fi

# 步骤 6: 完成
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 NewmindHub 启动完成！${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}访问地址:${NC}"
echo -e "  前端: ${GREEN}http://localhost:23001${NC}"
echo -e "  后端: ${GREEN}http://localhost:23000${NC}"
echo -e "  健康检查: ${GREEN}http://localhost:23000/api/health${NC}\n"

echo -e "${YELLOW}管理命令:${NC}"
echo -e "  查看日志: ${GREEN}./docker-deploy.sh logs${NC}"
echo -e "  重启服务: ${GREEN}./docker-deploy.sh restart${NC}"
echo -e "  停止服务: ${GREEN}./docker-deploy.sh down${NC}"
echo -e "  Stripe 日志: ${GREEN}docker logs -f stripe-webhook${NC}\n"

