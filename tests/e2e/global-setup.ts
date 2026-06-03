import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ensureSuperadmin } from '../../prisma/seed/superadmin';
import { SUPERADMIN, STORAGE_STATE } from './paths';

/**
 * Ensure a known dev superadmin + deterministic settings, then mint a session
 * directly in the DB and write it as a Playwright storageState. Authed tests
 * reuse this (no repeated logins -> no auth rate-limit flakiness).
 */
export default async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    await ensureSuperadmin(prisma);
    await prisma.instanceSettings.update({
      where: { id: 1 },
      data: { allowSelfRegistration: false, requireEmailVerification: true, brandName: '1MoreRep' },
    });
    // Reset the superadmin's onboarding flag so the onboarding E2E is repeatable
    // across runs (a completed onboarding would otherwise redirect /onboarding → /app).
    await prisma.user.updateMany({ where: { email: SUPERADMIN.email }, data: { onboardedAt: null } });

    // a second user (with a handle) for friends/social E2E
    await prisma.user.upsert({
      where: { email: 'frienduser@1morerep.local' },
      update: { status: 'ACTIVE', publicHandle: 'frienduser' },
      create: { email: 'frienduser@1morerep.local', displayName: 'Friend User', publicHandle: 'frienduser', status: 'ACTIVE' },
    });

    const user = await prisma.user.findUnique({ where: { email: SUPERADMIN.email } });
    if (user) {
      const id = crypto.randomBytes(24).toString('base64url');
      const secret = crypto.randomBytes(32).toString('base64url');
      const now = Date.now();
      await prisma.session.create({
        data: {
          id,
          userId: user.id,
          hashedSecret: crypto.createHash('sha256').update(secret).digest('hex'),
          idleExpiresAt: new Date(now + 7 * 864e5),
          absoluteExpiresAt: new Date(now + 30 * 864e5),
          label: 'e2e',
        },
      });
      mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
      writeFileSync(
        STORAGE_STATE,
        JSON.stringify({
          cookies: [
            {
              name: '1mr_session',
              value: `${id}.${secret}`,
              domain: 'localhost',
              path: '/',
              expires: Math.floor((now + 30 * 864e5) / 1000),
              httpOnly: true,
              secure: false,
              sameSite: 'Lax',
            },
          ],
          origins: [],
        }),
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[e2e global-setup] DB not ready:', (e as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}
