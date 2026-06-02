'use client';

import { useActionState } from 'react';
import { resetRequestAction, type ActionState } from '@/server/actions/auth';
import { TextField, Alert, SubmitBtn } from './ui';

export function ResetForm() {
  const [state, action] = useActionState(resetRequestAction, {} as ActionState);
  if (state.ok) return <Alert kind="notice">{state.notice}</Alert>;
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <SubmitBtn icon="arrowR">Send reset link</SubmitBtn>
    </form>
  );
}
