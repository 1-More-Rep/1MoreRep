'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Btn } from '@/components/ui/Btn';
import { SectionLabel } from '@/components/ui/typography';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { SIDEBAR_NAV, isActive } from './navConfig';

export function DesktopSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      style={{
        width: 240,
        height: '100%',
        background: 'var(--surface)',
        borderRight: '1px solid var(--line)',
        padding: 'var(--screen-pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <Link
        href="/app"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
          color: 'var(--text)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="bolt" size={20} stroke={2.1} />
        </span>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em' }}>1MoreRep</span>
      </Link>

      <Btn kind="primary" icon="plus" full>
        New workout
      </Btn>

      <SectionLabel style={{ marginTop: 4, paddingLeft: 6 }}>Menu</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SIDEBAR_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                textDecoration: 'none',
                fontSize: 14.5,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--accent-text)' : 'var(--text-2)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
              }}
            >
              <Icon name={item.icon} size={19} stroke={active ? 2.1 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {isAdmin && (
          <Link
            href="/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              textDecoration: 'none',
              fontSize: 14.5,
              color: 'var(--text-2)',
            }}
          >
            <Icon name="trophy" size={19} stroke={1.8} />
            Admin
          </Link>
        )}
        <Link
          href="/app/settings"
          aria-current={isActive(pathname, '/app/settings') ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '10px 12px',
            borderRadius: 'var(--r-sm)',
            textDecoration: 'none',
            fontSize: 14.5,
            color: 'var(--text-2)',
          }}
        >
          <Icon name="settings" size={19} stroke={1.8} />
          Settings
        </Link>
        <LogoutButton />
      </div>
    </nav>
  );
}
