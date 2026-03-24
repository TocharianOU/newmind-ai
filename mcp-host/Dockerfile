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

WORKDIR /app

COPY --from=deps /build/.venv /app/.venv
COPY --from=base /usr/local/bin/uv /usr/local/bin/uv
ENV PATH="/app/.venv/bin:$PATH"
ENV VIRTUAL_ENV=/app/.venv

COPY pyproject.toml uv.lock README.md ./
COPY attacktrace_mcp_host ./attacktrace_mcp_host
RUN uv pip install --no-cache --no-deps .

# Persistent volume for config, SQLite DB, uploads, cache, logs
VOLUME /app/data
RUN mkdir -p /app/data && echo '[]' > /app/data/plugin_config.json

ENV RESOURCE_DIR=/app/data
ENV ATTACKTRACE_CONFIG_DIR=/app/data

# Minimal service config — checkpointer SQLite in /app/data survives restarts.
# Override via DIVE_SERVICE_CONFIG_CONTENT if needed.
ENV DIVE_SERVICE_CONFIG_CONTENT='{"checkpointer":{"uri":"sqlite:////app/data/checkpointer.db"}}'

EXPOSE 61990

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:61990/health')" || exit 1

# --listen 0.0.0.0 is required — default 127.0.0.1 is unreachable inside Docker
CMD ["/app/.venv/bin/attacktrace_httpd", "--listen", "0.0.0.0", "--port", "61990"]
