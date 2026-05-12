#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/oaphub/downloads"
KIND="docker"
ARCH="x86_64"
HUB_IMAGE="oaphub-hub:latest"
MCP_IMAGE="oaphub-mcp-host:latest"
POSTGRES_IMAGE="postgres:16-alpine"
PORT="23000"
ADMIN_EMAIL="admin@test.com"
ADMIN_PASSWORD="password123"
POSTGRES_PASSWORD="password123"
JWT_SECRET="7f4b7f15a4bb4f2e9f2e8c80c6d1e8799f8f1a03f5bb4d4f9c8c2b24f4c51a8d"
OAP_AUTH_TOKEN="0db3a5b41094f37b836ba8268c9cc29b7e812cb506dff45c88c2c310b4bbd923"

usage() {
  cat <<'EOF'
Usage:
  scripts/build-customer-release.sh [options]

Options:
  --kind docker|kubernetes       Package type (default: docker)
  --arch x86_64|arm64            Target architecture label (default: x86_64)
  --output-dir DIR               Output directory (default: oaphub/downloads)
  --hub-image IMAGE              Hub image to export
  --mcp-image IMAGE              MCP host image to export
  --postgres-image IMAGE         Postgres image to export
  --port PORT                    Default exposed port
  --admin-email EMAIL            Default admin email
  --admin-password PASSWORD      Default admin password
  --postgres-password PASSWORD   Default Postgres password
  -h, --help                     Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kind) KIND="$2"; shift 2 ;;
    --arch) ARCH="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --hub-image) HUB_IMAGE="$2"; shift 2 ;;
    --mcp-image) MCP_IMAGE="$2"; shift 2 ;;
    --postgres-image) POSTGRES_IMAGE="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --postgres-password) POSTGRES_PASSWORD="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ "$KIND" != "docker" && "$KIND" != "kubernetes" ]]; then
  echo "--kind must be docker or kubernetes"
  exit 1
fi

if [[ "$KIND" == "docker" && "$ARCH" != "x86_64" && "$ARCH" != "arm64" ]]; then
  echo "--arch must be x86_64 or arm64"
  exit 1
fi

command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 1; }
mkdir -p "$OUTPUT_DIR"

if [[ "$KIND" == "kubernetes" ]]; then
  PACKAGE_NAME="oaphub-kubernetes-standard"
else
  PACKAGE_NAME="oaphub-docker-${ARCH}"
fi
WORK_DIR="$(mktemp -d)"
PACKAGE_DIR="$WORK_DIR/$PACKAGE_NAME"
mkdir -p "$PACKAGE_DIR/images"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

write_env() {
  cat > "$PACKAGE_DIR/.env" <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
OAP_AUTH_TOKEN=$OAP_AUTH_TOKEN

ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD

PORT=$PORT
DEPLOYMENT_MODE=enterprise
SSO_ENABLED=false
BILLING_ENABLED=false
INVITE_CODE_ENABLED=false
LICENSE_ENABLED=false
DOWNLOAD_INVITE_CODES=
FORCE_HTTPS=false
ALLOWED_ORIGINS=*
HUB_FRONTEND_URL=
EOF
}

write_docker_compose() {
  cat > "$PACKAGE_DIR/docker-compose.yml" <<'EOF'
name: oaphub

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: attacktrace
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  mcp-host:
    image: oaphub-mcp-host:latest
    restart: unless-stopped
    environment:
      OAP_AUTH_TOKEN: ${OAP_AUTH_TOKEN}
      HUB_INTERNAL_URL: http://hub:3000
      HUB_EXTERNAL_PORT: ${PORT:-23000}
    volumes:
      - mcp_data:/app/data

  hub:
    image: oaphub-hub:latest
    restart: unless-stopped
    ports:
      - "${PORT:-23000}:3000"
    volumes:
      - ./downloads:/app/downloads:ro
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/attacktrace
      JWT_SECRET: ${JWT_SECRET}
      MCP_HOST_URL: http://mcp-host:61990
      MCP_HOST_INTERNAL_TOKEN: ${OAP_AUTH_TOKEN}
      NODE_ENV: production
      ADMIN_EMAIL: ${ADMIN_EMAIL:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      FORCE_HTTPS: ${FORCE_HTTPS:-false}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-}
      HUB_FRONTEND_URL: ${HUB_FRONTEND_URL:-}
      DEPLOYMENT_MODE: ${DEPLOYMENT_MODE:-enterprise}
      SSO_ENABLED: ${SSO_ENABLED:-false}
      BILLING_ENABLED: ${BILLING_ENABLED:-false}
      INVITE_CODE_ENABLED: ${INVITE_CODE_ENABLED:-false}
      LICENSE_ENABLED: ${LICENSE_ENABLED:-false}
      DOWNLOAD_INVITE_CODES: ${DOWNLOAD_INVITE_CODES:-}
    depends_on:
      postgres:
        condition: service_healthy
      mcp-host:
        condition: service_started

volumes:
  postgres_data:
    external: true
    name: oaphub_postgres_data
  mcp_data:
    external: true
    name: oaphub_mcp_data
EOF
}

write_docker_installer() {
  cat > "$PACKAGE_DIR/install.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose is required."
  exit 1
fi

echo "Loading Docker images..."
gzip -dc images/oaphub-images.tar.gz | docker load

echo "Creating persistent volumes..."
docker volume create oaphub_postgres_data >/dev/null
docker volume create oaphub_mcp_data >/dev/null

echo "Starting OAP Hub..."
"${COMPOSE[@]}" up -d

echo
echo "Done."
echo "Chat UI: http://SERVER_IP:${PORT:-23000}/app/"
echo "Admin Console: http://SERVER_IP:${PORT:-23000}/console/"
EOF
  chmod +x "$PACKAGE_DIR/install.sh"
}

write_docker_deploy_doc() {
  cat > "$PACKAGE_DIR/DEPLOY.md" <<EOF
# OAP Hub Docker Deploy

Requirements: Docker and Docker Compose.

## Fresh install

\`\`\`bash
tar -xzf ${PACKAGE_NAME}.tar.gz
cd ${PACKAGE_NAME}
cp .env .env.backup
chmod +x install.sh
./install.sh
\`\`\`

Before production use, edit \`.env\` and replace at least:

- \`POSTGRES_PASSWORD\`
- \`JWT_SECRET\`
- \`OAP_AUTH_TOKEN\`
- \`ADMIN_PASSWORD\`
- \`ALLOWED_ORIGINS\`
- \`HUB_FRONTEND_URL\`

Open:

\`\`\`text
http://SERVER_IP:$PORT/app/
http://SERVER_IP:$PORT/console/
\`\`\`

Default login:

\`\`\`text
$ADMIN_EMAIL
$ADMIN_PASSWORD
\`\`\`

## Update an existing deployment

1. Back up the current package directory and \`.env\`.
2. Extract the new package in a separate directory.
3. Copy the old \`.env\` into the new package, then review new variables from the packaged \`.env\`.
4. Run the update commands below. Persistent Docker volumes are reused.

\`\`\`bash
tar -xzf ${PACKAGE_NAME}.tar.gz
cd ${PACKAGE_NAME}
cp /path/to/old/${PACKAGE_NAME}/.env .env
gzip -dc images/oaphub-images.tar.gz | docker load
docker compose up -d
docker compose ps
curl -fsS http://localhost:$PORT/api/health
\`\`\`

Do not delete the \`oaphub_postgres_data\` or \`oaphub_mcp_data\` Docker volumes during an update unless you intentionally want to remove persisted data.
EOF
}

write_docker_update_doc() {
  cat > "$PACKAGE_DIR/UPDATE.md" <<EOF
# OAP Hub Docker Update

Use this file when replacing an existing Docker deployment with a newer package.

## Safe update

\`\`\`bash
tar -xzf ${PACKAGE_NAME}.tar.gz
cd ${PACKAGE_NAME}
cp /path/to/current/.env .env
gzip -dc images/oaphub-images.tar.gz | docker load
docker compose up -d
docker compose ps
curl -fsS http://localhost:$PORT/api/health
\`\`\`

## Rollback

Keep the previous package directory. To roll back, load the previous package images again and run \`docker compose up -d\` from the previous directory.

\`\`\`bash
cd /path/to/previous-package
gzip -dc images/oaphub-images.tar.gz | docker load
docker compose up -d
\`\`\`

Data lives in external Docker volumes:

- \`oaphub_postgres_data\`
- \`oaphub_mcp_data\`

Do not remove these volumes during normal upgrades.
EOF
}

write_kubernetes_package() {
  mkdir -p "$PACKAGE_DIR/manifests"
  cat > "$PACKAGE_DIR/manifests/oaphub.yaml" <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: oaphub
---
apiVersion: v1
kind: Secret
metadata:
  name: oaphub-secret
  namespace: oaphub
type: Opaque
stringData:
  POSTGRES_PASSWORD: password123
  JWT_SECRET: 7f4b7f15a4bb4f2e9f2e8c80c6d1e8799f8f1a03f5bb4d4f9c8c2b24f4c51a8d
  OAP_AUTH_TOKEN: 0db3a5b41094f37b836ba8268c9cc29b7e812cb506dff45c88c2c310b4bbd923
  ADMIN_EMAIL: admin@test.com
  ADMIN_PASSWORD: password123
---
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
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mcp-data
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
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
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
              valueFrom:
                secretKeyRef:
                  name: oaphub-secret
                  key: POSTGRES_PASSWORD
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: postgres-data
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: oaphub
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-host
  namespace: oaphub
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-host
  template:
    metadata:
      labels:
        app: mcp-host
    spec:
      containers:
        - name: mcp-host
          image: oaphub-mcp-host:latest
          imagePullPolicy: IfNotPresent
          env:
            - name: OAP_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: oaphub-secret
                  key: OAP_AUTH_TOKEN
            - name: HUB_INTERNAL_URL
              value: http://hub:3000
          ports:
            - containerPort: 61990
          volumeMounts:
            - name: data
              mountPath: /app/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: mcp-data
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-host
  namespace: oaphub
spec:
  selector:
    app: mcp-host
  ports:
    - port: 61990
      targetPort: 61990
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hub
  namespace: oaphub
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hub
  template:
    metadata:
      labels:
        app: hub
    spec:
      containers:
        - name: hub
          image: oaphub-hub:latest
          imagePullPolicy: IfNotPresent
          env:
            - name: DATABASE_URL
              value: postgresql://postgres:password123@postgres:5432/attacktrace
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: oaphub-secret
                  key: JWT_SECRET
            - name: MCP_HOST_URL
              value: http://mcp-host:61990
            - name: MCP_HOST_INTERNAL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: oaphub-secret
                  key: OAP_AUTH_TOKEN
            - name: NODE_ENV
              value: production
            - name: ADMIN_EMAIL
              valueFrom:
                secretKeyRef:
                  name: oaphub-secret
                  key: ADMIN_EMAIL
            - name: ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: oaphub-secret
                  key: ADMIN_PASSWORD
            - name: DEPLOYMENT_MODE
              value: enterprise
          ports:
            - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: hub
  namespace: oaphub
spec:
  type: NodePort
  selector:
    app: hub
  ports:
    - port: 3000
      targetPort: 3000
      nodePort: 30080
EOF
  cat > "$PACKAGE_DIR/install.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
echo "Load images into your cluster nodes first if your cluster cannot see local Docker images."
echo "For single-node Docker-based clusters, start with:"
echo "  gzip -dc images/oaphub-images.tar.gz | docker load"
echo
kubectl apply -f manifests/oaphub.yaml
kubectl -n oaphub rollout status deploy/postgres
kubectl -n oaphub rollout status deploy/mcp-host
kubectl -n oaphub rollout status deploy/hub
echo "Open http://NODE_IP:30080/console/ or http://NODE_IP:30080/app/"
EOF
  chmod +x "$PACKAGE_DIR/install.sh"
  cat > "$PACKAGE_DIR/DEPLOY.md" <<'EOF'
# OAP Hub Kubernetes Deploy

Requirements: kubectl and a Kubernetes cluster with persistent volumes.

## Fresh install

```bash
tar -xzf oaphub-kubernetes-standard.tar.gz
cd oaphub-kubernetes-standard
gzip -dc images/oaphub-images.tar.gz | docker load
chmod +x install.sh
./install.sh
```

Default NodePort: `30080`.

Default login: `admin@test.com` / `password123`.

## Production checklist

- Replace all values in the `oaphub-secret` Secret.
- Push `oaphub-hub:latest` and `oaphub-mcp-host:latest` to your registry and update image names.
- Configure StorageClass/PVC settings for your cluster.
- Prefer Ingress with HTTPS over NodePort for production.
- Set `ALLOWED_ORIGINS` and public frontend URL for your domain.

## Update an existing deployment

```bash
tar -xzf oaphub-kubernetes-standard.tar.gz
cd oaphub-kubernetes-standard
gzip -dc images/oaphub-images.tar.gz | docker load
kubectl apply -f manifests/oaphub.yaml
kubectl -n oaphub rollout restart deploy/hub deploy/mcp-host
kubectl -n oaphub rollout status deploy/hub
kubectl -n oaphub rollout status deploy/mcp-host
kubectl -n oaphub get pods,svc,pvc
```

Do not delete the `postgres-data` or `mcp-data` PVCs during normal upgrades.
EOF
  cat > "$PACKAGE_DIR/UPDATE.md" <<'EOF'
# OAP Hub Kubernetes Update

## Safe update

1. Back up the existing Secret and manifests.
2. Load or push the new images.
3. Apply the new manifests after merging your production-specific Secret, registry, storage, Service, and Ingress changes.

```bash
kubectl -n oaphub get secret oaphub-secret -o yaml > oaphub-secret.backup.yaml
gzip -dc images/oaphub-images.tar.gz | docker load
kubectl apply -f manifests/oaphub.yaml
kubectl -n oaphub rollout restart deploy/hub deploy/mcp-host
kubectl -n oaphub rollout status deploy/hub
kubectl -n oaphub rollout status deploy/mcp-host
```

## Rollback

Roll back to the previous ReplicaSet or re-apply the previous manifest and image tag.

```bash
kubectl -n oaphub rollout undo deploy/hub
kubectl -n oaphub rollout undo deploy/mcp-host
kubectl -n oaphub rollout status deploy/hub
```

Keep these PVCs unless intentionally resetting data:

- `postgres-data`
- `mcp-data`
EOF
}

write_env
if [[ "$KIND" == "docker" ]]; then
  write_docker_compose
  write_docker_installer
  write_docker_deploy_doc
  write_docker_update_doc
else
  write_kubernetes_package
fi

echo "Saving Docker images..."
docker save "$HUB_IMAGE" "$MCP_IMAGE" "$POSTGRES_IMAGE" | gzip > "$PACKAGE_DIR/images/oaphub-images.tar.gz"

if [[ "$KIND" == "docker" ]]; then
  mkdir -p "$PACKAGE_DIR/downloads"
  touch "$PACKAGE_DIR/downloads/.gitkeep"
fi

ARCHIVE="$OUTPUT_DIR/$PACKAGE_NAME.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK_DIR" "$PACKAGE_NAME"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"

echo "Created: $ARCHIVE"
cat "$ARCHIVE.sha256"
