# NewMind AI — MCP Host
# Python 3.12, installed with uv for reproducible builds.
FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

# ── Install Python dependencies ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /build

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev --no-install-project

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# ── 连接器运行时层：Node.js 22 + 预装全部 stdio MCP 连接器 ────────────────────
# 所有连接器都是 Node 包，运行时必须在镜像内（客户环境离线，装不了）。
# 预装后 hub 的"安装"退化为启用登记：不下载、不联网、秒生效。
#
# 新增一个连接器：
#   1. 加到下面的 npm 列表或 _gh_install 列表
#   2. 在 hub 的 mcpHostSync.js STDIO_PACKAGE_REGISTRY 里加一条映射
#   3. 重建镜像
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    npm config set update-notifier false && \
    npm config set fund false && \
    npm config set fetch-retries 8 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000

# ── npm 已发布的连接器 ────────────────────────────────────────────────────────
RUN npm install -g --omit=dev --no-audit --no-fund \
    @tocharianou/elasticsearch-mcp@0.8.0 \
    @tocharianou/abuseipdb-mcp@1.0.1 \
    @tocharianou/mcp-shodan@1.0.1 \
    @tocharianou/mcp-virustotal@1.1.1 \
    @tocharianou/mcp-server-kibana@0.7.4 \
    @aws-sdk/client-cloudtrail@3.974.0 \
    @aws-sdk/core@3.974.0 \
    @tocharianou/cloudtrail-mcp@1.0.1

# ── 仅在 GitHub release 发布的连接器 ──────────────────────────────────────────
# 各 release tarball 结构不一致（扁平/嵌套/缺 package.json），helper 统一处理：
# 解压 → 拉平嵌套目录 → 补 package.json → 补装依赖 → 生成 /usr/local/bin 包装脚本
RUN set -e; \
    mkdir -p /opt/mcp-pkgs; \
    GH_RAW=https://raw.githubusercontent.com/TocharianOU; \
    GH=https://github.com/TocharianOU; \
    _gh_install() { \
        local name="$1" url="$2" repo="${3:-$name}"; \
        local dir="/opt/mcp-pkgs/$name"; \
        local tmp; tmp=$(mktemp -d); \
        echo ">> installing $name"; \
        curl -fsSL "$url" | tar -xz --warning=no-unknown-keyword -C "$tmp"; \
        mkdir -p "$dir"; \
        if [ ! -f "$tmp/package.json" ] && [ -d "$tmp/$name" ] && [ -f "$tmp/$name/package.json" ]; then \
            cp -r "$tmp/$name/." "$dir/"; rm -rf "$tmp"; \
        else \
            cp -r "$tmp/." "$dir/"; rm -rf "$tmp"; \
        fi; \
        if [ ! -f "$dir/package.json" ]; then \
            curl -fsSL "$GH_RAW/$repo/main/package.json" -o "$dir/package.json"; \
        fi; \
        if [ ! -d "$dir/node_modules" ]; then \
            cd "$dir" && npm install --omit=dev --ignore-scripts --no-audit --no-fund; \
        fi; \
        BIN=$(node -e "try{const p=require('$dir/package.json');const e=Object.entries(p.bin||{})[0];if(e){console.log(e[0]+'|'+e[1])}}catch(e){}" 2>/dev/null); \
        if [ -n "$BIN" ]; then \
            BNAME="${BIN%%|*}"; BREL="${BIN##*|}"; \
            printf '#!/bin/sh\nexec node %s "$@"\n' "$dir/$BREL" > "/usr/local/bin/$BNAME"; \
            chmod +x "/usr/local/bin/$BNAME"; \
            echo "   -> bin: $BNAME"; \
        fi; \
    }; \
    _gh_install splunk-mcp      "$GH/splunk-mcp/releases/download/v1.0.1/splunk-mcp-v1.0.1.tar.gz"; \
    _gh_install jira-mcp        "$GH/jira-mcp/releases/download/v1.0.0/jira-mcp-v1.0.0.tar.gz"; \
    _gh_install confluence-mcp  "$GH/confluence-mcp/releases/download/v1.0.0/confluence-mcp-v1.0.0.tar.gz"; \
    _gh_install mysql-mcp       "$GH/mysql-mcp/releases/download/v1.0.0/mysql-mcp-v1.0.0.tar.gz"; \
    _gh_install sqlserver-mcp   "$GH/sqlserver-mcp/releases/download/v1.0.0/sqlserver-mcp-v1.0.0.tar.gz"; \
    _gh_install cloudwatch-mcp  "$GH/cloudwatch-mcp/releases/download/v1.0.1/cloudwatch-mcp-v1.0.1.tar.gz"; \
    _gh_install aws-ec2-mcp     "$GH/aws-ec2-mcp/releases/download/v1.0.1/aws-ec2-mcp-v1.0.1.tar.gz"; \
    _gh_install aws-iam-mcp     "$GH/aws-iam-mcp/releases/download/v1.0.1/aws-iam-mcp-v1.0.1.tar.gz"; \
    _gh_install aws-s3-mcp      "$GH/aws-s3-mcp/releases/download/v1.0.1/aws-s3-mcp-v1.0.1.tar.gz"; \
    _gh_install aws-network-mcp "$GH/aws-network-mcp/releases/download/v1.0.1/aws-network-mcp-v1.0.1.tar.gz"; \
    _gh_install lambda-tool-mcp "$GH/lambda-tool-mcp/releases/download/v1.0.1/lambda-tool-mcp-v1.0.1.tar.gz"; \
    _gh_install aws-security-mcp "$GH/aws-security-mcp/releases/download/v1.0.1/aws-security-mcp-v1.0.1.tar.gz"

# ── 修复 abuseipdb-mcp@1.0.1 重复注册工具导致的崩溃（上游修复后可删）──────────
RUN node -e " \
  const fs = require('fs'); \
  const p = '/usr/lib/node_modules/@tocharianou/abuseipdb-mcp/dist/index.js'; \
  if (!fs.existsSync(p)) { console.log('abuseipdb-mcp: not found, skip'); process.exit(0) } \
  const c = fs.readFileSync(p, 'utf8'); \
  const before = 'registerBlockTools(server, client, maxTokenCall);\n    registerBlacklistTools(server, client, maxTokenCall);\n    registerBlockTools(server, client, maxTokenCall);\n    registerBlacklistTools(server, client, maxTokenCall);'; \
  const after  = 'registerBlockTools(server, client, maxTokenCall);\n    registerBlacklistTools(server, client, maxTokenCall);'; \
  if (c.includes(before)) { fs.writeFileSync(p, c.replace(before, after)); console.log('abuseipdb-mcp: duplicate fixed'); } \
  else { console.log('abuseipdb-mcp: already clean'); } \
"

# ── 把解析到 zod@4 的包降回 zod@3（MCP SDK ^1.x 仍依赖 zod-3 内部实现）────────
RUN GLOBALROOT=$(npm root -g); \
    for pkgdir in "$GLOBALROOT"/@tocharianou/* /opt/mcp-pkgs/*/; do \
        [ -f "$pkgdir/package.json" ] || continue; \
        zodpkg="$pkgdir/node_modules/zod/package.json"; \
        [ -f "$zodpkg" ] || continue; \
        zv=$(node -e "try{console.log(require('$zodpkg').version)}catch(e){}" 2>/dev/null); \
        case "$zv" in 4*) \
            echo "Fixing zod@$zv in $(basename $pkgdir)"; \
            cd "$pkgdir" && npm install --no-save --no-audit --no-fund zod@3.23.8 2>&1 | tail -1;; \
        esac; \
    done && echo "zod fix pass complete"

# ── 校验所有连接器可执行文件就位（缺失即构建失败，避免出货后才发现）──────────
RUN missing=""; \
    for b in elasticsearch-mcp abuseipdb-mcp mcp-shodan mcp-virustotal \
             mcp-server-kibana cloudtrail-mcp splunk-mcp jira-mcp \
             confluence-mcp mcp-server-mysql mcp-server-sqlserver \
             cloudwatch-mcp aws-ec2-mcp aws-iam-mcp aws-s3-mcp \
             aws-network-mcp lambda-tool-mcp aws-security-mcp; do \
        if which "$b" >/dev/null 2>&1; then echo "  ok: $b"; else echo "  MISSING: $b"; missing="$missing $b"; fi; \
    done; \
    [ -z "$missing" ] || { echo "❌ 连接器缺失:$missing"; exit 1; }


WORKDIR /app

COPY --from=deps /build/.venv /app/.venv
COPY --from=base /usr/local/bin/uv /usr/local/bin/uv
ENV PATH="/app/.venv/bin:$PATH"
ENV VIRTUAL_ENV=/app/.venv

COPY pyproject.toml uv.lock ./
COPY oap_mcp_host ./oap_mcp_host
RUN uv pip install --no-cache --no-deps .

# Persistent volume for config, SQLite DB, uploads, cache, logs
VOLUME /app/data
RUN mkdir -p /app/data \
    && echo '[]' > /app/data/plugin_config.json \
    && echo '{}' > /app/data/command_alias.json

ENV RESOURCE_DIR=/app/data
ENV OAP_CONFIG_DIR=/app/data

# Minimal service config — checkpointer SQLite in /app/data survives restarts.
# Override via DIVE_SERVICE_CONFIG_CONTENT if needed.
ENV DIVE_SERVICE_CONFIG_CONTENT='{"checkpointer":{"uri":"sqlite:////app/data/checkpointer.db"}}'

EXPOSE 61990

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:61990/health')" || exit 1

# --listen 0.0.0.0 is required — default 127.0.0.1 is unreachable inside Docker
CMD ["/app/.venv/bin/oap_httpd", "--listen", "0.0.0.0", "--port", "61990"]
