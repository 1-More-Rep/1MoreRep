'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { stopImpersonatingAction, type AdminState } from '@/server/actions/admin';
import { Btn } from '@/components/ui/Btn';

const empty: AdminState = {};

export function StopImpersonatingButton() {
  const t = useTranslations('admin');
  const [, action] = useActionState(async () => stopImpersonatingAction(), empty);
  return (
    <form action={action}>
      <Btn type="submit" kind="soft" size="sm" icon="x">
        {t('exitImpersonation')}
      </Btn>
    </form>
  );
}
