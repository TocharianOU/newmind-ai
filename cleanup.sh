#!/bin/bash
# AttackTrace 完全清理脚本
# 用途：清空所有缓存、配置、构建文件和数据库

set -e

echo "╔════════════════════════════════════════════╗"
echo "║   🧹 AttackTrace 完全清理脚本              ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "⚠️  警告：此操作将删除所有配置、缓存和数据库！"
echo ""
read -p "确认继续？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 1
fi

echo ""
echo "开始清理..."
echo ""

# 1. 清理用户目录下的所有配置
echo "1️⃣  清理用户配置目录..."
rm -rf ~/.attacktrace ~/.dive ~/.oap
rm -rf ~/Library/Application\ Support/AttackTrace 2>/dev/null || true
rm -rf ~/Library/Application\ Support/Dive 2>/dev/null || true
rm -rf ~/Library/Application\ Support/AttackTrace 2>/dev/null || true
rm -rf ~/Library/Caches/AttackTrace 2>/dev/null || true
rm -rf ~/Library/Caches/Dive 2>/dev/null || true
rm -rf ~/Library/Logs/AttackTrace 2>/dev/null || true
echo "   ✓ 用户配置已清空"

# 2. 清理项目目录构建文件
echo ""
echo "2️⃣  清理项目构建文件..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"
rm -rf dist dist-electron out build release .config
rm -rf node_modules/.vite .vite
rm -rf electron/main/*.js electron/main/**/*.js 2>/dev/null || true
rm -rf electron/preload/*.mjs 2>/dev/null || true
echo "   ✓ 构建文件已清空"

# 3. 清理 Python 缓存和数据库
echo ""
echo "3️⃣  清理 Python 缓存和数据库..."
cd "$SCRIPT_DIR/mcp-host"
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.db" -delete 2>/dev/null || true
find . -type f -name "*.sqlite" -delete 2>/dev/null || true
rm -rf .venv 2>/dev/null || true
echo "   ✓ Python 缓存已清空"

# 4. 询问是否重置 PostgreSQL 数据库
echo ""
echo "4️⃣  PostgreSQL 数据库清理..."
read -p "是否重置 PostgreSQL 数据库？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$SCRIPT_DIR/AttackTraceHub"  # OAP Platform
    echo "   停止并删除 Docker 容器和数据卷..."
    docker-compose down -v
    echo "   重新启动 PostgreSQL..."
    docker-compose up -d postgres
    echo "   等待数据库启动..."
    sleep 8
    echo "   运行数据库迁移..."
    npm run db:migrate -- --name add_mcp_download_fields
    echo "   运行数据库 seed..."
    npm run db:seed
    echo "   ✓ PostgreSQL 数据库已重置"
else
    echo "   ⊘ 跳过 PostgreSQL 重置"
fi

# 5. 清理项目配置文件
echo ""
echo "5️⃣  清理项目生成的配置文件..."
cd "$SCRIPT_DIR"
rm -rf .config
rm -f .config/*.json 2>/dev/null || true
rm -f .config/*.sqlite 2>/dev/null || true
rm -f .config/db.sqlite* 2>/dev/null || true
echo "   ✓ 项目配置已清空"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   ✅ 清理完成！                            ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "📝 接下来的步骤："
echo ""
echo "终端 1 - 启动 Hub 后端："
echo "  cd $SCRIPT_DIR/AttackTraceHub"  # OAP Platform
echo "  npm run dev"
echo ""
echo "终端 2 - 启动 AttackTrace Desktop："
echo "  cd $SCRIPT_DIR"
echo "  npm run dev"
echo ""
