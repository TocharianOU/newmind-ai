# 手动部署指南（非 Docker）

> 服务器 IP：`10.92.200.43`，端口：`23000`
> 管理员：`admin@test.starbucks.cn` / `starbuckstest123`
> 仅使用 apt / pip，无需 curl 安装外部工具

---

## 第一步：安装系统依赖

```bash
apt-get update
apt-get install -y git openssl build-essential wget python3.12 python3.12-venv python3-pip postgresql postgresql-client

# Node.js 20（通过 wget 添加 NodeSource 源）
wget -qO- https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 验证版本
node -v    # 应为 v20.x
python3.12 --version

# uv（用 pip 安装，不需要 curl）
pip3 install uv
```

---

## 第二步：初始化 PostgreSQL

```bash
systemctl start postgresql
systemctl enable postgresql

sudo -u postgres psql << 'SQL'
ALTER USER postgres PASSWORD 'starbuckstest123';
CREATE DATABASE attacktrace;
SQL
```

---

## 第三步：克隆代码

```bash
git clone -b starbucks-3 https://github.com/TocharianOU/attacktrace.git /opt/newmind-ai
```

---

## 第四步：写 .env

```bash
cat > /opt/newmind-ai/AttackTraceHub/.env << EOF
POSTGRES_PASSWORD=starbuckstest123
JWT_SECRET=$(openssl rand -hex 32)
ATTACKTRACE_AUTH_TOKEN=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@test.starbucks.cn
ADMIN_PASSWORD=starbuckstest123
ALLOWED_ORIGINS=http://10.92.200.43:23000
DEPLOYMENT_MODE=enterprise
SSO_ENABLED=false
BILLING_ENABLED=false
INVITE_CODE_ENABLED=false
LICENSE_ENABLED=false
EOF

# 加载到当前 shell
set -a; source /opt/newmind-ai/AttackTraceHub/.env; set +a
```

---

## 第五步：构建主聊天前端（/app/）

```bash
cd /opt/newmind-ai
npm install --ignore-scripts
npx vite build --config vite.config.web.ts
cp -r dist-web AttackTraceHub/app-dist
```

---

## 第六步：构建管理后台（/console/）

```bash
cd /opt/newmind-ai/AttackTraceHub/frontend
npm install --ignore-scripts
npx vite build
cp -r dist /opt/newmind-ai/AttackTraceHub/console-dist
```

---

## 第七步：Hub 依赖 + 数据库迁移

```bash
cd /opt/newmind-ai/AttackTraceHub
npm install

DATABASE_URL="postgresql://postgres:starbuckstest123@localhost:5432/attacktrace" \
  npx prisma migrate deploy
```

---

## 第八步：安装 MCP Host Python 依赖

```bash
cd /opt/newmind-ai/mcp-host

# 创建虚拟环境
python3.12 -m venv .venv
source .venv/bin/activate

# 安装依赖（用 uv，比 pip 快）
uv sync --frozen

# 预建数据目录
mkdir -p data
echo '[]' > data/plugin_config.json
echo '{}' > data/command_alias.json
```

---

## 第九步：启动 MCP Host

```bash
set -a; source /opt/newmind-ai/AttackTraceHub/.env; set +a

nohup env \
  ATTACKTRACE_AUTH_TOKEN="${ATTACKTRACE_AUTH_TOKEN}" \
  RESOURCE_DIR=/opt/newmind-ai/mcp-host/data \
  ATTACKTRACE_CONFIG_DIR=/opt/newmind-ai/mcp-host/data \
  DIVE_SERVICE_CONFIG_CONTENT='{"checkpointer":{"uri":"sqlite:////opt/newmind-ai/mcp-host/data/checkpointer.db"}}' \
  /opt/newmind-ai/mcp-host/.venv/bin/attacktrace_httpd \
  --listen 0.0.0.0 --port 61990 \
  > /var/log/mcp-host.log 2>&1 &

echo "MCP Host PID: $!"
sleep 5 && curl -s http://localhost:61990/health
```

---

## 第十步：启动 Hub

```bash
set -a; source /opt/newmind-ai/AttackTraceHub/.env; set +a

nohup env \
  DATABASE_URL="postgresql://postgres:starbuckstest123@localhost:5432/attacktrace" \
  JWT_SECRET="${JWT_SECRET}" \
  MCP_HOST_URL="http://localhost:61990" \
  MCP_HOST_INTERNAL_TOKEN="${ATTACKTRACE_AUTH_TOKEN}" \
  ADMIN_EMAIL="admin@test.starbucks.cn" \
  ADMIN_PASSWORD="starbuckstest123" \
  ALLOWED_ORIGINS="http://10.92.200.43:23000" \
  DEPLOYMENT_MODE="enterprise" \
  SSO_ENABLED="false" \
  BILLING_ENABLED="false" \
  INVITE_CODE_ENABLED="false" \
  LICENSE_ENABLED="false" \
  NODE_ENV="production" \
  PORT=23000 \
  node src/server.js \
  > /var/log/hub.log 2>&1 &

echo "Hub PID: $!"
sleep 8 && curl -s http://localhost:3000/api/health
```

---

## 访问地址

- 聊天界面：`http://10.92.200.43:23000/app/`
- 管理后台：`http://10.92.200.43:23000/console/`
- 账号：`admin@test.starbucks.cn` / `starbuckstest123`

---

## 日志

```bash
tail -f /var/log/hub.log
tail -f /var/log/mcp-host.log
```

## 停止服务

```bash
pkill -f "node src/server.js"
pkill -f "attacktrace_httpd"
```

## 重启服务（重新执行第九、十步即可）

```bash
pkill -f "node src/server.js"; pkill -f "attacktrace_httpd"
sleep 2
set -a; source /opt/newmind-ai/AttackTraceHub/.env; set +a
# 然后重新执行第九步和第十步的 nohup 命令
```
