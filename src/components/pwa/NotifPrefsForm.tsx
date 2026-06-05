'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import type { NotificationPreference } from '@prisma/client';
import { updateNotifPrefsAction, type PushState } from '@/server/actions/push';
import { Btn } from '@/components/ui/Btn';
import { Alert } from '@/components/auth/ui';

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} /> {label}
    </label>
  );
}

export function NotifPrefsForm({ p }: { p: NotificationPreference }) {
  const t = useTranslations('settingsPages');
  const [state, action] = useActionState(updateNotifPrefsAction, {} as PushState);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="notice">{state.notice}</Alert>
      <Toggle name="streakAtRisk" label={t('prefStreakAtRisk')} defaultChecked={p.streakAtRisk} />
      <Toggle name="restTimerDone" label={t('prefRestTimerDone')} defaultChecked={p.restTimerDone} />
      <Toggle name="friendActivity" label={t('prefFriendActivity')} defaultChecked={p.friendActivity} />
      <Toggle name="leagueResults" label={t('prefLeagueResults')} defaultChecked={p.leagueResults} />
      <Toggle name="workoutReminder" label={t('prefWorkoutReminder')} defaultChecked={p.workoutReminder} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: 'var(--text-2)' }}>
        {t('quietHours')}
        <input type="number" name="quietHoursStart" min={0} max={23} placeholder="22" defaultValue={p.quietHoursStart ?? ''} style={numStyle} />
        {t('quietHoursTo')}
        <input type="number" name="quietHoursEnd" min={0} max={23} placeholder="7" defaultValue={p.quietHoursEnd ?? ''} style={numStyle} />
      </div>
      <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>{t('save')}</Btn>
    </form>
  );
}

const numStyle: React.CSSProperties = { width: 56, height: 38, padding: '0 8px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-mono)', textAlign: 'center' };
