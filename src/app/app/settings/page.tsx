import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { Card, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui';

export const dynamic = 'force-dynamic';

const SECTIONS: { href: string; icon: IconName; title: string; desc: string }[] = [
  { href: '/app/settings/account', icon: 'user', title: 'Account', desc: 'Email, password, units' },
  { href: '/app/settings/appearance', icon: 'sun', title: 'Appearance', desc: 'Theme, accent, density' },
  { href: '/app/settings/privacy', icon: 'settings', title: 'Privacy', desc: 'Profile, leaderboards, activity' },
  { href: '/app/settings/notifications', icon: 'bolt', title: 'Notifications', desc: 'Reminders and push' },
];

export default async function SettingsPage() {
  await requireUser();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Settings</h1>
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={19} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{s.desc}</div>
            </div>
            <Icon name="chevronR" size={18} stroke={1.8} />
          </Card>
        </Link>
      ))}
    </div>
  );
}
