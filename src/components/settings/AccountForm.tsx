'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Sex, UnitSystem } from '@prisma/client';
import { updateAccountAction, requestEmailChangeAction, type AccountState } from '@/server/actions/account';
import { Card, Btn, SectionLabel } from '@/components/ui';
import { Alert, TextField } from '@/components/auth/ui';

export function AccountForm({ displayName, unitSystem, timezone, email, sex }: { displayName: string; unitSystem: UnitSystem; timezone: string; email: string; sex: Sex }) {
  const t = useTranslations('settingsPages');
  const [state, action] = useActionState(updateAccountAction, {} as AccountState);
  const [emailState, emailAction] = useActionState(requestEmailChangeAction, {} as AccountState);
  const [tz, setTz] = useState(timezone);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>{t('profile')}</SectionLabel>
        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert kind="error">{state.error}</Alert>
          <Alert kind="notice">{state.notice}</Alert>
          <TextField label={t('displayName')} name="displayName" defaultValue={displayName} required />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{t('units')}</span>
            <select name="unitSystem" defaultValue={unitSystem} style={sel}>
              <option value="METRIC">{t('unitsMetric')}</option>
              <option value="IMPERIAL">{t('unitsImperial')}</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{t('sexOptional')}</span>
            <select name="sex" defaultValue={sex} style={sel}>
              <option value="UNSPECIFIED">{t('sexUnspecified')}</option>
              <option value="FEMALE">{t('sexFemale')}</option>
              <option value="MALE">{t('sexMale')}</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('sexHint')}</span>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <TextField label={t('timezone')} name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} />
            </div>
            <Btn type="button" kind="ghost" size="sm" onClick={() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}>{t('detect')}</Btn>
          </div>
          <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>{t('save')}</Btn>
        </form>
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>{t('email')}</SectionLabel>
        <form action={emailAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert kind="error">{emailState.error}</Alert>
          <Alert kind="notice">{emailState.notice}</Alert>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('currentEmail', { email })}</div>
          <TextField label={t('newEmail')} name="newEmail" type="email" placeholder="new@example.com" />
          <Btn type="submit" kind="soft" icon="arrowR" style={{ alignSelf: 'flex-start' }}>{t('sendConfirmation')}</Btn>
        </form>
      </Card>

      <a href="/api/export" style={{ textDecoration: 'none' }}>
        <Btn kind="ghost" icon="arrowR" full>{t('exportData')}</Btn>
      </a>
    </div>
  );
}

const sel: React.CSSProperties = { height: 46, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15 };
