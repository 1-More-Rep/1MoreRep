'use client';

import { useActionState } from 'react';
import { addBodyMetricAction, type ProgressState } from '@/server/actions/progress';
import { Btn } from '@/components/ui/Btn';
import { Alert, TextField } from '@/components/auth/ui';

export function BodyMetricForm() {
  const [state, action] = useActionState(addBodyMetricAction, {} as ProgressState);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <Alert kind="notice">{state.notice}</Alert>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        <TextField label="Bodyweight (kg)" name="bodyweightKg" type="number" inputMode="decimal" />
        <TextField label="Waist (cm)" name="waist" type="number" inputMode="decimal" />
        <TextField label="Chest (cm)" name="chest" type="number" inputMode="decimal" />
        <TextField label="Arms (cm)" name="arms" type="number" inputMode="decimal" />
        <TextField label="Thighs (cm)" name="thighs" type="number" inputMode="decimal" />
      </div>
      <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>Log entry</Btn>
    </form>
  );
}
