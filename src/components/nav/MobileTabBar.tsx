'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { MOBILE_TABS, isActive } from './navConfig';

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '8px 14px calc(8px + env(safe-area-inset-bottom, 18px))',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
      }}
    >
      {MOBILE_TABS.map((it) => {
        if (!('href' in it)) {
          return (
            <Link
              key="add"
              href="/app/workout/new"
              aria-label="New workout"
              style={{
                width: 50,
                height: 50,
                borderRadius: 'var(--r)',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow)',
                marginTop: -6,
                flexShrink: 0,
              }}
            >
              <Icon name="plus" size={24} stroke={2.4} />
            </Link>
          );
        }
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.id}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '4px 8px',
              width: 56,
              minHeight: 48, // WCAG 2.5.5 / Apple HIG minimum tap target
              textDecoration: 'none',
              color: active ? 'var(--accent-text)' : 'var(--text-3)',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 30,
                borderRadius: 'var(--r-pill)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                transition: 'background .15s',
              }}
            >
              <Icon name={it.icon} size={22} stroke={active ? 2.2 : 1.8} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
