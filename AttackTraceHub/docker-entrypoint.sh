#!/bin/sh
# NewMind AI — Hub startup script
set -e

echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy

# Auto-create admin on first boot when ADMIN_EMAIL is set
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const { randomUUID } = require('node:crypto');
    const prisma = new PrismaClient();
    (async () => {
      const existing = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL } });
      if (existing) {
        if (existing.role !== 'ADMIN') {
          await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
          console.log('[entrypoint] Promoted ' + process.env.ADMIN_EMAIL + ' to ADMIN');
        } else {
          console.log('[entrypoint] Admin already exists: ' + process.env.ADMIN_EMAIL);
        }
      } else {
        const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        const uid = randomUUID();
        await prisma.user.create({
          data: {
            id: uid, email: process.env.ADMIN_EMAIL, username: 'Admin',
            password: hashed, role: 'ADMIN',
            Subscription: { create: { id: randomUUID(), planName: 'ENTERPRISE', isDefaultPlan: false, isActive: true, updatedAt: new Date() } },
            Project: { create: { id: 'default', name: 'Default', description: 'Default project', isDefault: true, updatedAt: new Date() } }
          }
        });
        console.log('[entrypoint] Created admin: ' + process.env.ADMIN_EMAIL);
      }
      await prisma.\$disconnect();
    })().catch(e => { console.error('[entrypoint] Admin seed failed:', e.message); });
  "
fi

echo "[entrypoint] Starting server..."
exec node src/server.js
