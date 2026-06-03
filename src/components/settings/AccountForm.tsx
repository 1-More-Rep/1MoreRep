'use client';

import { useActionState, useState } from 'react';
import type { UnitSystem } from '@prisma/client';
import { updateAccountAction, requestEmailChangeAction, type AccountState } from '@/server/actions/account';
import { Card, Btn, SectionLabel } from '@/components/ui';
import { Alert, TextField } from '@/components/auth/ui';

export function AccountForm({ displayName, unitSystem, timezone, email }: { displayName: string; unitSystem: UnitSystem; timezone: string; email: string }) {
  const [state, action] = useActionState(updateAccountAction, {} as AccountState);
  const [emailState, emailAction] = useActionState(requestEmailChangeAction, {} as AccountState);
  const [tz, setTz] = useState(timezone);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>Profile</SectionLabel>
        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert kind="error">{state.error}</Alert>
          <Alert kind="notice">{state.notice}</Alert>
          <TextField label="Display name" name="displayName" defaultValue={displayName} required />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Units</span>
            <select name="unitSystem" defaultValue={unitSystem} style={sel}>
              <option value="METRIC">Metric (kg, cm)</option>
              <option value="IMPERIAL">Imperial (lb, in)</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <TextField label="Timezone" name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} />
            </div>
            <Btn type="button" kind="ghost" size="sm" onClick={() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}>Detect</Btn>
          </div>
          <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>Save</Btn>
        </form>
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>Email</SectionLabel>
        <form action={emailAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Alert kind="error">{emailState.error}</Alert>
          <Alert kind="notice">{emailState.notice}</Alert>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Current: {email}</div>
          <TextField label="New email" name="newEmail" type="email" placeholder="new@example.com" />
          <Btn type="submit" kind="soft" icon="arrowR" style={{ alignSelf: 'flex-start' }}>Send confirmation</Btn>
        </form>
      </Card>

      <a href="/api/export" style={{ textDecoration: 'none' }}>
        <Btn kind="ghost" icon="arrowR" full>Export my data (JSON)</Btn>
      </a>
    </div>
  );
}

const sel: React.CSSProperties = { height: 46, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15 };
