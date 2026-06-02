/**
 * Idempotent seed entrypoint (run on every boot via docker-entrypoint and in
 * dev). Ensures instance settings + a bootstrapped superadmin, then records a
 * marker. Exercise library seeding is added in P4.
 */
import { PrismaClient } from '@prisma/client';
import { ensureSuperadmin } from './superadmin';

const prisma = new PrismaClient();

async function main() {
  const boot = await ensureSuperadmin(prisma);
  if (boot.created) {
    // eslint-disable-next-line no-console
    console.log(
      `\n════════ SUPERADMIN CREATED ════════\n` +
        `  Email:    ${boot.email}\n` +
        (boot.generated ? `  Password: ${boot.password}\n  (Save this now — it will not be shown again. Change it on first login.)\n` : `  Password: (as provided)\n`) +
        `════════════════════════════════════\n`,
    );
  }

  await prisma.appMeta.upsert({
    where: { key: 'seed:bootstrap' },
    update: { value: new Date().toISOString() },
    create: { key: 'seed:bootstrap', value: new Date().toISOString() },
  });
  // eslint-disable-next-line no-console
  console.log('[seed] done');
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
