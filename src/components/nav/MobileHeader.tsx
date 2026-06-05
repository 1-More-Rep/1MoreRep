'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';
import { MoreMenuSheet } from './MoreMenuSheet';

/**
 * Slim sticky top bar shown only on mobile (the desktop sidebar covers these
 * destinations). Carries the wordmark + a "More" button that opens a sheet so
 * every non-tab route (Workouts, Muscles, Exercises, Friends, …) is reachable.
 */
export function MobileHeader({ brandName = '1MoreRep' }: { brandName?: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('nav');
  return (
    <>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: 'calc(env(safe-area-inset-top, 0px) + 9px) var(--screen-pad) 9px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <Link
          href="/app"
          aria-label={brandName}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: 'var(--text)' }}
        >
          <span
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--r-sm)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bolt" size={18} stroke={2.1} />
          </span>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em' }}>{brandName}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('more')}
          aria-haspopup="dialog"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            minHeight: 40,
            padding: '0 12px',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--line-2)',
            background: 'var(--surface-2)',
            color: 'var(--text-2)',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <Icon name="menu" size={18} stroke={2} />
          {t('more')}
        </button>
      </header>
      <MoreMenuSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
