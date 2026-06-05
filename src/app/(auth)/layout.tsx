import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { Icon } from '@/components/ui/Icon';
import { getSettings } from '@/lib/settings';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings().catch(() => null);
  const brand = settings?.brandName ?? '1MoreRep';
  const locale = await getLocale();
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: 'var(--screen-pad)',
        background: 'var(--bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="bolt" size={23} stroke={2.1} />
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>{brand}</span>
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow)',
          padding: 'calc(var(--pad) * 1.4)',
        }}
      >
        {children}
      </div>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 170 }}>
          <LanguageSelector current={isLocale(locale) ? locale : DEFAULT_LOCALE} />
        </div>
      </div>
    </main>
  );
}
