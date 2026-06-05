'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/ui/typography';

interface Step {
  icon: IconName;
  title: string;
  body: ReactNode;
}

/**
 * Multi-step "Add to Home Screen" walkthrough for iOS/iPadOS users who aren't in
 * standalone mode yet (iOS only delivers web push to installed PWAs). Reusable —
 * surface anywhere a non-standalone iOS user should be guided to install.
 */
export function InstallGuide({ steps }: { steps?: Step[] }) {
  const t = useTranslations('settingsPages');
  const bold = (chunks: ReactNode) => <strong>{chunks}</strong>;
  const iosSteps: Step[] = [
    { icon: 'more', title: t('stepShareTitle'), body: t.rich('stepShareBody', { strong: bold }) },
    { icon: 'plus', title: t('stepAddTitle'), body: t.rich('stepAddBody', { strong: bold }) },
    { icon: 'home', title: t('stepReopenTitle'), body: t.rich('stepReopenBody', { strong: bold }) },
    { icon: 'bolt', title: t('stepEnableTitle'), body: t.rich('stepEnableBody', { strong: bold }) },
  ];
  const resolvedSteps = steps ?? iosSteps;
  return (
    <div data-testid="install-guide" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <SectionLabel>{t('installToGetNotifications')}</SectionLabel>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '6px 0 0', lineHeight: 1.45 }}>
          {t('installIntro')}
        </p>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {resolvedSteps.map((step, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line)',
              background: 'var(--surface)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: 99,
                background: 'var(--accent-soft)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                position: 'relative',
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5, fontWeight: 600 }}>
                <Icon name={step.icon} size={16} />
                <span>{step.title}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.45 }}>{step.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
