'use client';

import { useActionState } from 'react';
import { addBodyMetricAction, updateBodyMetricAction, type ProgressState } from '@/server/actions/progress';
import { Btn } from '@/components/ui/Btn';
import { Alert, TextField } from '@/components/auth/ui';
import { weightUnit, lengthUnit, weightInputValue, lengthInputValue, type UnitSystemLike } from '@/domain/units';

export interface BodyMetricEdit {
  id: string;
  bodyweightKg?: number | null;
  measurements?: { waist?: number; chest?: number; arms?: number; thighs?: number; hips?: number } | null;
}

export function BodyMetricForm({ edit, unitSystem }: { edit?: BodyMetricEdit; unitSystem: UnitSystemLike }) {
  const [state, action, pending] = useActionState(edit ? updateBodyMetricAction : addBodyMetricAction, {} as ProgressState);
  const m = edit?.measurements ?? {};
  const wu = weightUnit(unitSystem);
  const lu = lengthUnit(unitSystem);
  // Stored values are canonical kg/cm; show them in the user's unit. The server action
  // converts the submitted values back to kg/cm (it reads the user's unitSystem).
  const len = (v?: number) => lengthInputValue(v ?? null, unitSystem);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <Alert kind="notice">{state.notice}</Alert>
      {edit && <input type="hidden" name="id" value={edit.id} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        <TextField label={`Bodyweight (${wu})`} name="bodyweightKg" type="number" inputMode="decimal" defaultValue={weightInputValue(edit?.bodyweightKg, unitSystem)} />
        <TextField label={`Waist (${lu})`} name="waist" type="number" inputMode="decimal" defaultValue={len(m.waist)} />
        <TextField label={`Chest (${lu})`} name="chest" type="number" inputMode="decimal" defaultValue={len(m.chest)} />
        <TextField label={`Arms (${lu})`} name="arms" type="number" inputMode="decimal" defaultValue={len(m.arms)} />
        <TextField label={`Thighs (${lu})`} name="thighs" type="number" inputMode="decimal" defaultValue={len(m.thighs)} />
        <TextField label={`Hips (${lu})`} name="hips" type="number" inputMode="decimal" defaultValue={len(m.hips)} />
      </div>
      {/* Disable while the action is in flight so a double-tap can't create duplicate entries. */}
      <Btn type="submit" icon="check" disabled={pending} style={{ alignSelf: 'flex-start' }}>{edit ? 'Save changes' : 'Log entry'}</Btn>
    </form>
  );
}
