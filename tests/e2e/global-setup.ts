import { PrismaClient } from '@prisma/client';
import { ensureSuperadmin } from '../../prisma/seed/superadmin';

/**
 * Ensure a known dev superadmin exists and reset instance settings to a
 * deterministic baseline before the E2E run (authenticated admin tests).
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
  } catch (e) {
    // If the DB isn't reachable, authed admin tests will be skipped by their guard.
    // eslint-disable-next-line no-console
    console.warn('[e2e global-setup] DB not ready:', (e as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

export const DEV_SUPERADMIN = { email: 'admin@1morerep.local', password: 'devsuperpass123' };
