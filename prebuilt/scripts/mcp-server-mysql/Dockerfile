# MySQL MCP Server Docker Image
FROM node:20-alpine

WORKDIR /app

# 复制源代码（必须在 npm ci 之前，因为 prepare 脚本会立即构建）
COPY . .

# 安装所有依赖（包括devDependencies用于构建）
# 注意：npm ci 会触发 prepare 脚本自动执行 npm run build
RUN npm ci

# 清理devDependencies减小镜像大小
RUN npm prune --production

# 健康检查（使用127.0.0.1避免IPv6解析问题）
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${MCP_HTTP_PORT:-3000}/health || exit 1

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/index.js"]
