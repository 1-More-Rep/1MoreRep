import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { currentSessionId } from '@/lib/auth/session';
import { listUserSessions } from '@/server/queries/sessions';
import { SessionsManager } from '@/components/settings/SessionsManager';

export const dynamic = 'force-dynamic';

export default async function SessionsSettingsPage() {
  const user = await requireUser();
  const currentId = await currentSessionId();
  const sessions = await listUserSessions(user.id, currentId);
  const t = await getTranslations('settingsPages');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/settings" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('backToSettings')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('sessionsTitle')}</h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
        {t('sessionsIntro')}
      </p>
      <SessionsManager sessions={sessions} />
    </div>
  );
}
