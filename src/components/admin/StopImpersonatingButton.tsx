'use client';

import { useActionState } from 'react';
import { stopImpersonatingAction, type AdminState } from '@/server/actions/admin';
import { Btn } from '@/components/ui/Btn';

const empty: AdminState = {};

export function StopImpersonatingButton() {
  const [, action] = useActionState(async () => stopImpersonatingAction(), empty);
  return (
    <form action={action}>
      <Btn type="submit" kind="soft" size="sm" icon="x">
        Exit impersonation
      </Btn>
    </form>
  );
}
