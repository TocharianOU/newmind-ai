#!/bin/sh
# NewMind AI — Hub startup script
set -e

echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Syncing schema to database..."
npx prisma db push --accept-data-loss --skip-generate

# Auto-create admin on first boot when ADMIN_EMAIL is set
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  node --input-type=module -e "
    import { PrismaClient } from '@prisma/client';
    import bcrypt from 'bcryptjs';
    import { randomUUID } from 'node:crypto';
    const prisma = new PrismaClient();
    try {
      const email = process.env.ADMIN_EMAIL;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        if (existing.role !== 'ADMIN') {
          await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
          console.log('[entrypoint] Promoted ' + email + ' to ADMIN');
        } else {
          console.log('[entrypoint] Admin already exists: ' + email);
        }
      } else {
        const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        const now = new Date();
        await prisma.user.create({
          data: {
            id: randomUUID(), email, username: 'Admin',
            password: hashed, role: 'ADMIN',
            Subscription: { create: { id: randomUUID(), planName: 'ENTERPRISE', isDefaultPlan: false, isActive: true, updatedAt: now } },
            Project: { create: { id: randomUUID(), name: 'Default', description: 'Default project', isDefault: true, updatedAt: now } }
          }
        });
        console.log('[entrypoint] Created admin: ' + email);
      }
    } catch (e) {
      console.error('[entrypoint] Admin seed failed:', e.message);
    } finally {
      await prisma.\$disconnect();
    }
  "
fi

echo "[entrypoint] Starting server..."
exec node src/server.js
