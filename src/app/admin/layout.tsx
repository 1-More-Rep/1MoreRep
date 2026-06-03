import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, hasRole } from '@/lib/auth/guards';
import { Icon } from '@/components/ui/Icon';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'chart' as const },
  { href: '/admin/users', label: 'Users', icon: 'user' as const },
  { href: '/admin/settings', label: 'Settings', icon: 'settings' as const },
  { href: '/admin/audit', label: 'Audit log', icon: 'history' as const },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasRole(user, 'ADMIN')) redirect('/app');

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <ImpersonationBanner />
      <header
        style={{
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface)',
          padding: '0 var(--screen-pad)',
        }}
      >
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 18, height: 60 }}>
          <Link href="/app" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text)' }}>
            <span style={{ width: 30, height: 30, borderRadius: 'var(--r-xs)', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bolt" size={17} stroke={2.1} />
            </span>
            <strong style={{ fontSize: 15 }}>Admin</strong>
          </Link>
          <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 11px',
                  borderRadius: 'var(--r-sm)',
                  textDecoration: 'none',
                  color: 'var(--text-2)',
                  fontSize: 14,
                }}
              >
                <Icon name={n.icon} size={16} stroke={1.8} />
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/app" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>
            ← Back to app
          </Link>
        </div>
      </header>
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: 'var(--screen-pad)' }}>{children}</main>
    </div>
  );
}
