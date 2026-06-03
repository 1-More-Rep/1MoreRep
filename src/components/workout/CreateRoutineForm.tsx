'use client';

import { useActionState } from 'react';
import { createRoutineAction, type RoutineState } from '@/server/actions/routines';
import { Btn } from '@/components/ui/Btn';
import { Alert, TextField } from '@/components/auth/ui';

export function CreateRoutineForm() {
  const [state, action] = useActionState(createRoutineAction, {} as RoutineState);
  return (
    <form action={action} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 220px' }}>
        <Alert kind="error">{state.error}</Alert>
        <TextField label="New routine" name="name" placeholder="Push Day" required minLength={2} />
      </div>
      <select name="goal" defaultValue="" aria-label="Goal" style={{ height: 46, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}>
        <option value="">No goal</option>
        <option value="HYPERTROPHY">Hypertrophy</option>
        <option value="STRENGTH">Strength</option>
        <option value="ENDURANCE">Endurance</option>
        <option value="GENERAL">General</option>
      </select>
      <Btn type="submit" icon="plus">Create</Btn>
    </form>
  );
}
