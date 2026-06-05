'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Btn } from '@/components/ui/Btn';
import { Icon } from '@/components/ui/Icon';
import { Mono, SectionLabel } from '@/components/ui/typography';

/**
 * `activeDays` / `todayKey` are 'YYYY-MM-DD' keys computed server-side in the
 * user's timezone, so the grid stays tz-correct regardless of the browser tz.
 */
export function HistoryCalendar({ activeDays, currentStreak, todayKey }: { activeDays: string[]; currentStreak: number; todayKey: string }) {
  const t = useTranslations('history');
  const locale = useLocale();
  const weekdays = t('weekdays').split(',');
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);
  const active = useMemo(() => new Set(activeDays), [activeDays]);
  // `cursor` is the first of the displayed month, seeded from today's key.
  const [ty, tm] = todayKey.split('-').map(Number);
  const [cursor, setCursor] = useState(() => new Date(ty!, tm! - 1, 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset for the 1st of the month (JS getDay: 0=Sun..6=Sat).
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: localKey(new Date(year, month, d)) });

  const shift = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
        <SectionLabel>{monthFmt.format(cursor)}</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentStreak > 0 && (
            <Chip accent>
              <Icon name="flame" size={13} /> <Mono>{currentStreak}</Mono>&nbsp;{t('dayStreak')}
            </Chip>
          )}
          <Btn kind="soft" size="sm" aria-label={t('prevMonth')} onClick={() => shift(-1)} style={{ padding: '0 12px', fontSize: 17 }}>
            ‹
          </Btn>
          <Btn kind="soft" size="sm" aria-label={t('nextMonth')} onClick={() => shift(1)} style={{ padding: '0 12px', fontSize: 17 }}>
            ›
          </Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {weekdays.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{w}</div>
        ))}
        {cells.map((c, i) =>
          c == null ? (
            <div key={`e${i}`} />
          ) : (
            <div
              key={c.key}
              title={active.has(c.key) ? t('workoutCompleted') : undefined}
              style={{
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--r-sm)',
                fontSize: 12.5,
                fontFamily: 'var(--font-mono)',
                fontFeatureSettings: '"tnum" 1',
                background: active.has(c.key) ? 'var(--accent)' : 'var(--surface-2)',
                color: active.has(c.key) ? 'var(--on-accent)' : 'var(--text-3)',
                fontWeight: active.has(c.key) ? 700 : 500,
                border: c.key === todayKey ? '1.5px solid var(--accent-strong)' : '1px solid transparent',
              }}
            >
              {c.day}
            </div>
          ),
        )}
      </div>
    </Card>
  );
}

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
