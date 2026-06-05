'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { revokeSessionAction, logoutOtherSessionsAction } from '@/server/actions/session';
import { Card, Btn, Chip, Icon } from '@/components/ui';
import type { UserSessionRow } from '@/server/queries/sessions';

/** Parse a short, human-friendly label from a User-Agent string. */
function describeDevice(ua: string | null, unknownLabel: string, onLabel: (browser: string, os: string) => string): string {
  if (!ua) return unknownLabel;
  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let os = '';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (browser && os) return onLabel(browser, os);
  if (browser) return browser;
  if (os) return os;
  return unknownLabel;
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function SessionsManager({ sessions }: { sessions: UserSessionRow[] }) {
  const t = useTranslations('settingsPages');
  const [pending, startTransition] = useTransition();
  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {sessions.map((s) => (
        <Card key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="settings" size={19} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{s.label || describeDevice(s.userAgent, t('unknownDevice'), (browser, os) => t('deviceOn', { browser, os }))}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{t('lastUsed', { date: fmtDate(s.lastUsedAt) })}</div>
          </div>
          {s.isCurrent ? (
            <Chip accent>{t('thisDevice')}</Chip>
          ) : (
            <Btn
              kind="ghost"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(() => revokeSessionAction(s.id))}
            >
              {t('revoke')}
            </Btn>
          )}
        </Card>
      ))}

      {otherCount > 0 && (
        <Btn
          kind="soft"
          icon="x"
          full
          disabled={pending}
          onClick={() => startTransition(() => logoutOtherSessionsAction())}
        >
          {t('logoutEverywhere')}
        </Btn>
      )}
    </div>
  );
}
