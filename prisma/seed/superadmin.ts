import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/lib/auth/password';

const DEV_SUPERADMIN_EMAIL = 'admin@1morerep.local';
const DEV_SUPERADMIN_PASSWORD = 'devsuperpass123';

export interface BootstrapResult {
  created: boolean;
  email?: string;
  password?: string;
  generated?: boolean;
}

/** Ensure the singleton InstanceSettings row exists. */
export async function ensureInstanceSettings(prisma: PrismaClient): Promise<void> {
  await prisma.instanceSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/**
 * Idempotently bootstrap a SUPERADMIN.
 * - In production: requires SUPERADMIN_EMAIL; uses SUPERADMIN_PASSWORD or a
 *   generated one; forces a password change on first login.
 * - In dev/test (no SUPERADMIN_EMAIL): creates a known dev superadmin so the
 *   app and E2E tests are usable out of the box.
 */
export async function ensureSuperadmin(prisma: PrismaClient): Promise<BootstrapResult> {
  await ensureInstanceSettings(prisma);

  const existing = await prisma.user.count({ where: { role: 'SUPERADMIN' } });
  if (existing > 0) return { created: false };

  const isProd = process.env.NODE_ENV === 'production';
  const email = (process.env.SUPERADMIN_EMAIL || (isProd ? '' : DEV_SUPERADMIN_EMAIL)).trim().toLowerCase();
  if (!email) {
    // eslint-disable-next-line no-console
    console.log('[seed] SUPERADMIN_EMAIL not set; skipping superadmin bootstrap.');
    return { created: false };
  }

  const provided = process.env.SUPERADMIN_PASSWORD;
  const password = provided || (isProd ? crypto.randomBytes(12).toString('base64url') : DEV_SUPERADMIN_PASSWORD);
  const generated = !provided;

  await prisma.user.create({
    data: {
      email,
      displayName: 'Administrator',
      passwordHash: await hashPassword(password),
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      // Force a change only in production; dev keeps the known password for tests.
      mustChangePassword: isProd,
    },
  });

  return { created: true, email, password, generated };
}
