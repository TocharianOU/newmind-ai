# OAP Hub Docker Deploy

1. Create `oaphub/.env`:

```env
POSTGRES_PASSWORD=password123
JWT_SECRET=7f4b7f15a4bb4f2e9f2e8c80c6d1e8799f8f1a03f5bb4d4f9c8c2b24f4c51a8d
OAP_AUTH_TOKEN=0db3a5b41094f37b836ba8268c9cc29b7e812cb506dff45c88c2c310b4bbd923

ADMIN_EMAIL=admin@test.com
ADMIN_PASSWORD=password123

PORT=23000
DEPLOYMENT_MODE=enterprise
SSO_ENABLED=false
BILLING_ENABLED=false
INVITE_CODE_ENABLED=false
LICENSE_ENABLED=false
FORCE_HTTPS=false
ALLOWED_ORIGINS=
HUB_FRONTEND_URL=
```

2. Create volumes once:

```bash
docker volume create oaphub_postgres_data
docker volume create oaphub_mcp_data
```

3. Build and start:

```bash
cd oaphub
docker compose build --no-cache
docker compose up -d
```

Open `http://SERVER_IP:23000/app/` or `http://SERVER_IP:23000/console/`.
