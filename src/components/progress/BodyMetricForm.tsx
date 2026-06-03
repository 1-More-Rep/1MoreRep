'use client';

import { useActionState } from 'react';
import { addBodyMetricAction, updateBodyMetricAction, type ProgressState } from '@/server/actions/progress';
import { Btn } from '@/components/ui/Btn';
import { Alert, TextField } from '@/components/auth/ui';

export interface BodyMetricEdit {
  id: string;
  bodyweightKg?: number | null;
  measurements?: { waist?: number; chest?: number; arms?: number; thighs?: number; hips?: number } | null;
}

export function BodyMetricForm({ edit }: { edit?: BodyMetricEdit }) {
  const [state, action] = useActionState(edit ? updateBodyMetricAction : addBodyMetricAction, {} as ProgressState);
  const m = edit?.measurements ?? {};
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <Alert kind="notice">{state.notice}</Alert>
      {edit && <input type="hidden" name="id" value={edit.id} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        <TextField label="Bodyweight (kg)" name="bodyweightKg" type="number" inputMode="decimal" defaultValue={edit?.bodyweightKg ?? undefined} />
        <TextField label="Waist (cm)" name="waist" type="number" inputMode="decimal" defaultValue={m.waist ?? undefined} />
        <TextField label="Chest (cm)" name="chest" type="number" inputMode="decimal" defaultValue={m.chest ?? undefined} />
        <TextField label="Arms (cm)" name="arms" type="number" inputMode="decimal" defaultValue={m.arms ?? undefined} />
        <TextField label="Thighs (cm)" name="thighs" type="number" inputMode="decimal" defaultValue={m.thighs ?? undefined} />
        <TextField label="Hips (cm)" name="hips" type="number" inputMode="decimal" defaultValue={m.hips ?? undefined} />
      </div>
      <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>{edit ? 'Save changes' : 'Log entry'}</Btn>
    </form>
  );
}
