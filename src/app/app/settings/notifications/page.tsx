import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/server/db/prisma';
import { getVapidPublicKey } from '@/server/push';
import { Card } from '@/components/ui/Card';
import { PushManager } from '@/components/pwa/PushManager';
import { NotifPrefsForm } from '@/components/pwa/NotifPrefsForm';

export const dynamic = 'force-dynamic';

export default async function NotificationsSettingsPage() {
  const user = await requireUser();
  const prefs = await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  const t = await getTranslations('settingsPages');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/settings" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('backToSettings')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('notificationsTitle')}</h1>
      <Card><PushManager vapidPublicKey={getVapidPublicKey()} /></Card>
      <Card><NotifPrefsForm p={prefs} /></Card>
    </div>
  );
}
