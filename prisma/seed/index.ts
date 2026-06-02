/**
 * Idempotent seed entrypoint. Expanded per phase (exercise library in P4,
 * instance settings + superadmin bootstrap in P3). P0 just records a marker
 * so we can prove the seed pipeline runs end-to-end.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.appMeta.upsert({
    where: { key: 'seed:bootstrap' },
    update: { value: new Date().toISOString() },
    create: { key: 'seed:bootstrap', value: new Date().toISOString() },
  });
  // eslint-disable-next-line no-console
  console.log('[seed] bootstrap marker written');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
