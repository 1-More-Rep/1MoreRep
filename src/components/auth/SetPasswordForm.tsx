'use client';

import { useActionState } from 'react';
import { changePasswordAction, type ActionState } from '@/server/actions/auth';
import { TextField, Alert, SubmitBtn } from './ui';

export function SetPasswordForm() {
  const [state, action] = useActionState(changePasswordAction, {} as ActionState);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      <SubmitBtn icon="check">Save password</SubmitBtn>
    </form>
  );
}
