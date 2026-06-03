'use client';

import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/ui/typography';

interface Step {
  icon: IconName;
  title: string;
  body: ReactNode;
}

const IOS_STEPS: Step[] = [
  {
    icon: 'more',
    title: 'Tap the Share button',
    body: (
      <>
        In Safari, tap the <strong>Share</strong> icon (a square with an arrow pointing up) in the toolbar.
      </>
    ),
  },
  {
    icon: 'plus',
    title: 'Add to Home Screen',
    body: (
      <>
        Scroll the share sheet and choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
      </>
    ),
  },
  {
    icon: 'home',
    title: 'Reopen from the Home Screen',
    body: <>Close Safari and launch <strong>1MoreRep</strong> from the new Home Screen icon.</>,
  },
  {
    icon: 'bolt',
    title: 'Enable notifications',
    body: <>Come back to this screen inside the installed app and tap <strong>Enable notifications</strong>.</>,
  },
];

/**
 * Multi-step "Add to Home Screen" walkthrough for iOS/iPadOS users who aren't in
 * standalone mode yet (iOS only delivers web push to installed PWAs). Reusable —
 * surface anywhere a non-standalone iOS user should be guided to install.
 */
export function InstallGuide({ steps = IOS_STEPS }: { steps?: Step[] }) {
  return (
    <div data-testid="install-guide" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <SectionLabel>Install to get notifications</SectionLabel>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '6px 0 0', lineHeight: 1.45 }}>
          On iPhone &amp; iPad, push notifications only work after you add 1MoreRep to your Home Screen.
        </p>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => (
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
