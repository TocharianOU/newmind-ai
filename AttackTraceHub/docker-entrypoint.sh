#!/bin/sh
# NewMind AI — Hub startup script
# Runs Prisma migrations before starting the server.
set -e

echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Starting server..."
exec node src/server.js
