import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { Card, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui';

export const dynamic = 'force-dynamic';

const SECTIONS: { href: string; icon: IconName; titleKey: string; descKey: string }[] = [
  { href: '/app/settings/account', icon: 'user', titleKey: 'account', descKey: 'accountDesc' },
  { href: '/app/settings/appearance', icon: 'sun', titleKey: 'appearance', descKey: 'appearanceDesc' },
  { href: '/app/settings/language', icon: 'globe', titleKey: 'language', descKey: 'languageDesc' },
  { href: '/app/settings/security', icon: 'shield', titleKey: 'security', descKey: 'securityDesc' },
  { href: '/app/settings/privacy', icon: 'settings', titleKey: 'privacy', descKey: 'privacyDesc' },
  { href: '/app/settings/notifications', icon: 'bolt', titleKey: 'notifications', descKey: 'notificationsDesc' },
  { href: '/app/settings/sessions', icon: 'settings', titleKey: 'sessions', descKey: 'sessionsDesc' },
  { href: '/app/feedback', icon: 'megaphone', titleKey: 'feedback', descKey: 'feedbackDesc' },
];

export default async function SettingsPage() {
  await requireUser();
  const t = await getTranslations('settings');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('title')}</h1>
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={19} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t(s.titleKey)}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{t(s.descKey)}</div>
            </div>
            <Icon name="chevronR" size={18} stroke={1.8} />
          </Card>
        </Link>
      ))}
    </div>
  );
}
