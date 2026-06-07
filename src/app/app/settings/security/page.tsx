import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/server/db/prisma';
import { SecurityControls } from '@/components/settings/SecurityControls';

export const dynamic = 'force-dynamic';

export default async function SecuritySettingsPage() {
  const user = await requireUser();
  const tn = await getTranslations('nav');
  const ts = await getTranslations('security');

  const [passkeys, backupRemaining] = await Promise.all([
    prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true, deviceType: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.backupCode.count({ where: { userId: user.id, usedAt: null } }),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 560 }}>
      <Link href="/app/settings" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {tn('settings')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{ts('title')}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>{ts('intro')}</p>
      <SecurityControls
        passkeys={passkeys.map((p) => ({
          id: p.id,
          name: p.name,
          deviceType: p.deviceType,
          createdAt: p.createdAt.toISOString(),
          lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
        }))}
        totpEnabled={user.totpEnabledAt != null}
        backupRemaining={backupRemaining}
      />
    </div>
  );
}
