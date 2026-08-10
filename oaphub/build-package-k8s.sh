#!/bin/bash

# Kubernetes 客户部署包打包脚本
# 产出: downloads/oaphub-kubernetes-standard.tar.gz (+ .sha256)
# 包内容: k8s manifests + 镜像 tar + load-images.sh + DEPLOY-K8S.md
# 用法: bash build-package-k8s.sh
# 说明: 集群通常是 x86_64；请在 x86_64 机器上执行以导出匹配架构的镜像。

set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'; NC='\033[0m'

VERSION=$(node -p "require('../package.json').version" 2>/dev/null || echo "3.0.0")
PKG_NAME="oaphub-kubernetes-standard"
STAGE_DIR="$(mktemp -d)/${PKG_NAME}"
trap 'rm -rf "$(dirname "$STAGE_DIR")"' EXIT
mkdir -p "$STAGE_DIR/manifests" downloads

echo "📦 打包 ${PKG_NAME} (版本 ${VERSION})"
echo "===================================="

# 1. 构建并导出镜像
echo "🔨 构建镜像..."
docker compose build
docker tag oaphub-hub "oaphub-hub:${VERSION}"
docker tag oaphub-mcp-host "oaphub-mcp-host:${VERSION}"
docker pull postgres:16-alpine --quiet 2>/dev/null || true
echo "💾 导出镜像..."
docker save -o "$STAGE_DIR/images.tar" \
    "oaphub-hub:${VERSION}" "oaphub-mcp-host:${VERSION}" postgres:16-alpine

# 2. 生成 k8s manifests
cat > "$STAGE_DIR/manifests/00-namespace.yaml" <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: oaphub
EOF

# 密钥与配置（部署前请修改）
cat > "$STAGE_DIR/manifests/01-config.yaml" <<'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: oaphub-secrets
  namespace: oaphub
type: Opaque
stringData:
  # ⚠️ 部署前务必修改以下值
  POSTGRES_PASSWORD: "Newmind@123"
  JWT_SECRET: "CHANGE_ME_openssl_rand_hex_32"
  OAP_AUTH_TOKEN: "CHANGE_ME_openssl_rand_hex_32"
  ADMIN_PASSWORD: "Newmind@123"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: oaphub-config
  namespace: oaphub
data:
  ADMIN_EMAIL: "admin@test.com"
  DEPLOYMENT_MODE: "enterprise"
  SSO_ENABLED: "false"
  BILLING_ENABLED: "false"
  INVITE_CODE_ENABLED: "true"
  INVITE_CODES: "hellonewmind"
  LICENSE_ENABLED: "false"
  FORCE_HTTPS: "false"
  # 公网访问时改为实际域名，例如 https://ai.example.com
  ALLOWED_ORIGINS: ""
EOF

cat > "$STAGE_DIR/manifests/02-postgres.yaml" <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: oaphub
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: oaphub
spec:
  replicas: 1
  selector:
    matchLabels: { app: postgres }
  template:
    metadata:
      labels: { app: postgres }
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          env:
            - name: POSTGRES_DB
              value: attacktrace
            - name: POSTGRES_USER
              value: postgres
            - name: POSTGRES_PASSWORD
              valueFrom: { secretKeyRef: { name: oaphub-secrets, key: POSTGRES_PASSWORD } }
          ports: [{ containerPort: 5432 }]
          volumeMounts:
            - { name: data, mountPath: /var/lib/postgresql/data }
          readinessProbe:
            exec: { command: ["pg_isready", "-U", "postgres"] }
            initialDelaySeconds: 10
            periodSeconds: 10
      volumes:
        - name: data
          persistentVolumeClaim: { claimName: postgres-data }
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: oaphub
spec:
  selector: { app: postgres }
  ports: [{ port: 5432, targetPort: 5432 }]
EOF

cat > "$STAGE_DIR/manifests/03-mcp-host.yaml" <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-host
  namespace: oaphub
spec:
  replicas: 1
  selector:
    matchLabels: { app: mcp-host }
  template:
    metadata:
      labels: { app: mcp-host }
    spec:
      containers:
        - name: mcp-host
          image: oaphub-mcp-host:${VERSION}
          imagePullPolicy: IfNotPresent
          env:
            - name: OAP_AUTH_TOKEN
              valueFrom: { secretKeyRef: { name: oaphub-secrets, key: OAP_AUTH_TOKEN } }
            - name: HUB_INTERNAL_URL
              value: http://hub:3000
          ports: [{ containerPort: 61990 }]
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-host
  namespace: oaphub
spec:
  selector: { app: mcp-host }
  ports: [{ port: 61990, targetPort: 61990 }]
EOF

cat > "$STAGE_DIR/manifests/04-hub.yaml" <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hub
  namespace: oaphub
spec:
  replicas: 1
  selector:
    matchLabels: { app: hub }
  template:
    metadata:
      labels: { app: hub }
    spec:
      containers:
        - name: hub
          image: oaphub-hub:${VERSION}
          imagePullPolicy: IfNotPresent
          env:
            - name: DATABASE_URL
              value: postgresql://postgres:\$(POSTGRES_PASSWORD)@postgres:5432/attacktrace
            - name: POSTGRES_PASSWORD
              valueFrom: { secretKeyRef: { name: oaphub-secrets, key: POSTGRES_PASSWORD } }
            - name: JWT_SECRET
              valueFrom: { secretKeyRef: { name: oaphub-secrets, key: JWT_SECRET } }
            - name: MCP_HOST_URL
              value: http://mcp-host:61990
            - name: MCP_HOST_INTERNAL_TOKEN
              valueFrom: { secretKeyRef: { name: oaphub-secrets, key: OAP_AUTH_TOKEN } }
            - name: ADMIN_PASSWORD
              valueFrom: { secretKeyRef: { name: oaphub-secrets, key: ADMIN_PASSWORD } }
            - name: NODE_ENV
              value: production
          envFrom:
            - configMapRef: { name: oaphub-config }
          ports: [{ containerPort: 3000 }]
          readinessProbe:
            httpGet: { path: /api/health, port: 3000 }
            initialDelaySeconds: 15
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: hub
  namespace: oaphub
spec:
  type: NodePort
  selector: { app: hub }
  ports:
    - port: 3000
      targetPort: 3000
      nodePort: 30000
EOF

# 3. 镜像导入脚本（各节点执行，或推送到镜像仓库）
cat > "$STAGE_DIR/load-images.sh" <<'EOF'
#!/bin/bash
# 将镜像导入本地容器运行时。集群多节点时，请改为推送到镜像仓库后修改 manifests 中的 image。
set -e
cd "$(dirname "$0")"
if command -v docker >/dev/null 2>&1; then
    docker load -i images.tar
elif command -v ctr >/dev/null 2>&1; then
    ctr -n k8s.io images import images.tar
elif command -v nerdctl >/dev/null 2>&1; then
    nerdctl load -i images.tar
else
    echo "未找到 docker/ctr/nerdctl，请手动导入 images.tar"; exit 1
fi
echo "✅ 镜像已导入"
EOF
chmod +x "$STAGE_DIR/load-images.sh"

# 4. 部署说明
cat > "$STAGE_DIR/DEPLOY-K8S.md" <<EOF
# OAP Hub — Kubernetes 部署 (v${VERSION})

## 前置
- Kubernetes 集群 (x86_64)，kubectl 已配置
- 默认 StorageClass 可用（用于 PostgreSQL PVC）
- 镜像分发：单节点用 load-images.sh 本地导入；多节点建议推送到镜像仓库

## 步骤

1. 导入镜像（单节点）：
   \`\`\`bash
   bash load-images.sh
   \`\`\`
   多节点：\`docker load -i images.tar\` 后 \`docker tag\` + \`docker push\` 到你的仓库，
   并把 manifests/03、04 里的 image 改为仓库地址。

2. 修改密钥（必须）：编辑 \`manifests/01-config.yaml\`，替换 JWT_SECRET / OAP_AUTH_TOKEN
   （\`openssl rand -hex 32\`）和默认密码；公网访问时设置 ALLOWED_ORIGINS。

3. 部署：
   \`\`\`bash
   kubectl apply -f manifests/
   kubectl -n oaphub rollout status deploy/hub
   \`\`\`

4. 访问：\`http://<节点IP>:30000/app/\`（聊天）、\`/console/\`（后台）。
   生产环境建议前置 Ingress + TLS，替代 NodePort。

## 默认凭据
admin@test.com / Newmind@123（首次登录后请立即修改）
EOF

# 5. 压缩 + 校验和（标准 "hash  文件名" 格式，可直接 sha256sum -c）
echo "🗜  压缩..."
OUT="downloads/${PKG_NAME}.tar.gz"
tar -czf "$OUT" -C "$(dirname "$STAGE_DIR")" "$PKG_NAME"
( cd downloads && { shasum -a 256 "${PKG_NAME}.tar.gz" 2>/dev/null || sha256sum "${PKG_NAME}.tar.gz"; } > "${PKG_NAME}.tar.gz.sha256" )

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo -e "${GREEN}🎉 打包完成: ${OUT} (${SIZE})${NC}"
