#!/bin/bash
# NewmindHub Docker部署脚本
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 检查.env文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}未找到.env文件，正在创建...${NC}"
    cp env.docker.example .env
    echo -e "${RED}请编辑.env文件配置后再运行！${NC}"
    exit 1
fi

COMMAND=${1:-up}

case $COMMAND in
    setup)
        BACKEND_URL=${2:-"http://localhost:23000"}
        
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  NewmindHub 一键部署${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
        echo -e "${YELLOW}后端地址: ${BACKEND_URL}${NC}\n"
        
        # 1. 启动服务
        echo -e "${YELLOW}[1/4] 启动服务...${NC}"
        docker-compose up -d
        echo -e "${GREEN}✓ 服务已启动${NC}\n"
        sleep 30
        
        # 2. 初始化数据库
        echo -e "${YELLOW}[2/4] 初始化数据库...${NC}"
        docker-compose exec backend npx prisma migrate deploy
        docker-compose exec backend npx prisma db push --accept-data-loss --skip-generate
        docker-compose up -d --force-recreate backend
        echo -e "${GREEN}✓ 数据库初始化完成${NC}\n"
        
        # 3. 配置 Stripe（如果需要）
        echo -e "${YELLOW}[3/4] 配置 Stripe Webhook...${NC}"
        CURRENT_SECRET=$(grep "^STRIPE_WEBHOOK_SECRET=" .env | cut -d'=' -f2 || echo "")
        
        if [[ -z "$CURRENT_SECRET" || "$CURRENT_SECRET" == "whsec_your_webhook_secret_here" ]]; then
            echo -e "${YELLOW}正在获取 Webhook Secret...${NC}"
            chmod +x ./setup-stripe-webhook.sh
            ./setup-stripe-webhook.sh "$BACKEND_URL"
        else
            echo -e "${GREEN}✓ 已有 Webhook Secret: ${CURRENT_SECRET:0:20}...${NC}\n"
        fi
        
        # 4. 启动 Stripe 监听器
        echo -e "${YELLOW}[4/4] 启动 Stripe 监听器...${NC}"
        chmod +x ./start-stripe-webhook.sh
        ./start-stripe-webhook.sh "$BACKEND_URL" <<< "y"
        
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}🎉 部署完成！${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
        
        FRONTEND_URL=$(echo "$BACKEND_URL" | sed 's/:23000/:23001/')
        echo -e "${YELLOW}访问地址:${NC}"
        echo -e "  前端: ${GREEN}${FRONTEND_URL}${NC}"
        echo -e "  后端: ${GREEN}${BACKEND_URL}${NC}\n"
        echo -e "${YELLOW}管理命令:${NC}"
        echo -e "  查看 Stripe 日志: ${GREEN}docker logs -f stripe-webhook${NC}"
        echo -e "  停止 Stripe: ${GREEN}docker stop stripe-webhook${NC}\n"
        ;;
    
    up)
        echo -e "${GREEN}启动NewmindHub服务...${NC}"
        docker-compose up -d
        echo -e "${GREEN}✓ 服务已启动${NC}"
        echo -e "${GREEN}前端: http://localhost:23001${NC}"
        echo -e "${GREEN}后端: http://localhost:23000${NC}"
        echo -e "${GREEN}文档: http://localhost:23002${NC}"
        ;;
    
    down)
        echo -e "${YELLOW}停止服务...${NC}"
        docker-compose down
        echo -e "${GREEN}✓ 服务已停止${NC}"
        ;;
    
    logs)
        SERVICE=${2:-""}
        if [ -z "$SERVICE" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$SERVICE"
        fi
        ;;
    
    rebuild)
        echo -e "${GREEN}重新构建服务...${NC}"
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        echo -e "${GREEN}✓ 重新构建完成${NC}"
        ;;
    
    migrate)
        echo -e "${GREEN}数据库初始化...${NC}"
        echo -e "${YELLOW}警告: 这会重置数据库结构！${NC}"
        echo -e "${YELLOW}继续? (y/n) [如已初始化可跳过]${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}步骤 1/3: 应用迁移...${NC}"
            docker-compose exec backend npx prisma migrate deploy
            echo -e "${YELLOW}步骤 2/3: 同步结构...${NC}"
            docker-compose exec backend npx prisma db push --accept-data-loss --skip-generate
            echo -e "${YELLOW}步骤 3/3: 重启后端...${NC}"
            docker-compose restart backend
            echo -e "${GREEN}✓ 数据库初始化完成${NC}"
        else
            echo -e "${YELLOW}已跳过${NC}"
        fi
        ;;
    
    init-db)
        echo -e "${GREEN}强制初始化数据库（无确认）...${NC}"
        docker-compose exec backend npx prisma migrate deploy
        docker-compose exec backend npx prisma db push --accept-data-loss --skip-generate
        docker-compose restart backend
        echo -e "${GREEN}✓ 数据库初始化完成${NC}"
        ;;
    
    clean)
        echo -e "${RED}清空所有 Docker 数据...${NC}"
        echo -e "${YELLOW}警告: 这将删除所有容器、镜像和数据！${NC}"
        echo -e "${YELLOW}是否继续? (y/n)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            docker-compose down -v
            docker system prune -af
            echo -e "${GREEN}✓ 清理完成${NC}"
        else
            echo -e "${YELLOW}已取消${NC}"
        fi
        ;;
    
    restart)
        echo -e "${GREEN}重新加载后端服务...${NC}"
        docker-compose up -d --force-recreate backend
        echo -e "${GREEN}✓ 后端已重新加载${NC}"
        echo -e "${YELLOW}提示: 环境变量(.env)已重新加载${NC}"
        ;;
    
    restart-stripe)
        BACKEND_URL=${2:-"http://localhost:23000"}
        
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  重新配置 Stripe（保留数据库）${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
        echo -e "${YELLOW}后端地址: ${BACKEND_URL}${NC}\n"
        
        # 1. 配置 Stripe
        echo -e "${YELLOW}[1/2] 配置 Stripe Webhook...${NC}"
        chmod +x ./setup-stripe-webhook.sh
        ./setup-stripe-webhook.sh "$BACKEND_URL"
        
        # 2. 重启 Stripe 监听器（如果在运行）
        echo -e "${YELLOW}[2/2] 重启 Stripe 监听器...${NC}"
        if docker ps | grep -q stripe-webhook; then
            docker stop stripe-webhook 2>/dev/null || true
            docker rm stripe-webhook 2>/dev/null || true
            echo -e "${GREEN}✓ 已停止旧的监听器${NC}"
        fi
        
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}🎉 Stripe 配置完成！${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
        echo -e "${YELLOW}启动新的监听器:${NC}"
        echo -e "  ${GREEN}./start-stripe-webhook.sh ${BACKEND_URL}${NC}\n"
        ;;
    
    *)
        echo "NewmindHub Docker部署"
        echo ""
        echo "用法: ./docker-deploy.sh [命令]"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "快速启动:"
        echo "  setup [url]  - 🚀 一键部署（启动 + 初始化 + 配置 Stripe）"
        echo "                 示例: ./docker-deploy.sh setup http://192.168.1.3:23000"
        echo ""
        echo "核心命令:"
        echo "  up           - 启动所有服务"
        echo "  down         - 停止所有服务"
        echo "  restart      - 重启后端（更新.env后）"
        echo "  rebuild      - 重新构建并启动（代码修改后）"
        echo "  restart-stripe [url] - 重新配置 Stripe（保留数据库）"
        echo ""
        echo "数据库命令:"
        echo "  migrate  - 初始化数据库（带确认）"
        echo "  init-db  - 强制初始化数据库（无确认）"
        echo ""
        echo "其他命令:"
        echo "  logs     - 查看日志 (logs backend/frontend/postgres)"
        echo "  clean    - 清空所有数据（危险）"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "示例:"
        echo "  首次部署:           ./docker-deploy.sh setup http://192.168.1.3:23000"
        echo "  代码更新:           ./docker-deploy.sh rebuild"
        echo "  .env 修改:          ./docker-deploy.sh restart"
        echo "  Stripe 配置修改:    ./docker-deploy.sh restart-stripe http://192.168.1.3:23000"
        ;;
esac
