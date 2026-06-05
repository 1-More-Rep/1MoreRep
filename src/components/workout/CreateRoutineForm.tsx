'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createRoutineAction, type RoutineState } from '@/server/actions/routines';
import { Btn } from '@/components/ui/Btn';
import { Alert, TextField } from '@/components/auth/ui';

export function CreateRoutineForm() {
  const t = useTranslations('workout');
  const [state, action] = useActionState(createRoutineAction, {} as RoutineState);
  return (
    <form action={action} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 220px' }}>
        <Alert kind="error">{state.error}</Alert>
        <TextField label={t('newRoutineLabel')} name="name" placeholder={t('newRoutinePlaceholder')} required minLength={2} />
      </div>
      <select name="goal" defaultValue="" aria-label={t('goal')} style={{ height: 46, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}>
        <option value="">{t('noGoal')}</option>
        <option value="HYPERTROPHY">{t('goal_HYPERTROPHY')}</option>
        <option value="STRENGTH">{t('goal_STRENGTH')}</option>
        <option value="ENDURANCE">{t('goal_ENDURANCE')}</option>
        <option value="GENERAL">{t('goal_GENERAL')}</option>
      </select>
      <Btn type="submit" icon="plus">{t('create')}</Btn>
    </form>
  );
}
