# OAP Hub Docker Deploy

## 一键部署（推荐）

```bash
cd oaphub
bash deploy.sh
```

脚本会自动完成：从 `env.copy` 生成 `.env`（随机生成 `JWT_SECRET`/`OAP_AUTH_TOKEN`）、创建数据卷、处理端口占用、构建镜像、启动并等待就绪。可重复运行（幂等）。

完成后访问：
- 聊天应用: `http://localhost:23000/app/`
- 管理后台: `http://localhost:23000/console/`（默认 `admin@test.com / Newmind@123`）

常用命令：

```bash
bash deploy.sh --logs   # 查看日志
bash deploy.sh --stop   # 停止服务
```

自定义配置：编辑 `oaphub/.env`（端口、管理员、功能开关等，模板见 `env.copy`），然后重新 `bash deploy.sh`。

## 手动部署

1. `cp env.copy .env`，填写 `JWT_SECRET` 和 `OAP_AUTH_TOKEN`（`openssl rand -hex 32`）
2. 创建卷: `docker volume create oaphub_postgres_data && docker volume create oaphub_mcp_data`
3. 构建启动: `docker compose build && docker compose up -d`

> ⚠️ 生产环境请修改 `.env` 中的默认密码，并配置 `FORCE_HTTPS`/`ALLOWED_ORIGINS`。
