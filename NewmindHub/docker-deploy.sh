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
    up)
        echo -e "${GREEN}启动NewmindHub服务...${NC}"
        docker-compose up -d
        echo -e "${GREEN}✓ 服务已启动${NC}"
        echo -e "${GREEN}前端: http://localhost:3001${NC}"
        echo -e "${GREEN}后端: http://localhost:3000${NC}"
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
        echo -e "${GREEN}运行数据库迁移...${NC}"
        docker-compose exec backend npx prisma migrate deploy
        echo -e "${GREEN}✓ 迁移完成${NC}"
        ;;
    
    *)
        echo "NewmindHub Docker部署"
        echo ""
        echo "用法: ./docker-deploy.sh [命令]"
        echo ""
        echo "命令:"
        echo "  up       - 启动所有服务"
        echo "  down     - 停止所有服务"
        echo "  logs     - 查看日志 (可选: logs backend/frontend/postgres)"
        echo "  rebuild  - 重新构建并启动"
        echo "  migrate  - 运行数据库迁移"
        ;;
esac
