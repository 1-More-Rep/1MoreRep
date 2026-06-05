'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { MORE_NAV, isActive } from './navConfig';

/** Bottom sheet listing the secondary destinations not on the bottom tab bar. */
export function MoreMenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  // Close the sheet whenever the route changes (after a link is tapped).
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sheet open={open} onClose={onClose} title="More">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MORE_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                minHeight: 52,
                padding: '10px 8px',
                borderRadius: 'var(--r-sm)',
                textDecoration: 'none',
                color: active ? 'var(--accent-text)' : 'var(--text)',
                background: active ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--r-sm)',
                  background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: active ? 'var(--accent-text)' : 'var(--text-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name={item.icon} size={20} stroke={1.9} />
              </span>
              <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600 }}>{item.label}</span>
              <Icon name="chevronR" size={16} stroke={1.8} style={{ color: 'var(--text-3)' }} />
            </Link>
          );
        })}
      </div>
    </Sheet>
  );
}
