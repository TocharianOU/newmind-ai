# Frontend Dockerfile for OAP Platform
FROM node:20-alpine

WORKDIR /app

# 接收构建参数
ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_DOCS_URL=http://localhost:23002
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DOCS_URL=$VITE_DOCS_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Install serve for production
RUN npm install -g serve

# Copy serve configuration to app root
COPY serve.json ./serve.json

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/ || exit 1

# Start serve on port 3001 with configuration file in app root
CMD ["serve", "-s", "dist", "-l", "3001", "-c", "/app/serve.json", "--no-port-switching"]
