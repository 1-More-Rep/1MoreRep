'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createCustomExerciseAction, type ExerciseFormState } from '@/server/actions/exercises';
import { MUSCLES, MUSCLE_LABEL } from '@/domain/muscles/taxonomy';
import { Btn } from '@/components/ui/Btn';
import { Alert, TextField } from '@/components/auth/ui';

const EQUIPMENT = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND', 'EZ_BAR', 'BALL', 'OTHER'];

export function CreateExerciseForm() {
  const t = useTranslations('exercises');
  const [state, action] = useActionState(createCustomExerciseAction, {} as ExerciseFormState);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <TextField label={t('name')} name="name" required minLength={2} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label={t('equipment')}>
          <select name="equipment" defaultValue="BARBELL" style={sel}>
            {EQUIPMENT.map((e) => (
              <option key={e} value={e}>{cap(e)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('mechanic')}>
          <select name="mechanic" defaultValue="" style={sel}>
            <option value="">—</option>
            <option value="COMPOUND">{t('compound')}</option>
            <option value="ISOLATION">{t('isolation')}</option>
          </select>
        </Field>
      </div>
      <Field label={t('primaryMuscle')}>
        <select name="primaryMuscle" defaultValue="CHEST" style={sel}>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>{MUSCLE_LABEL[m]}</option>
          ))}
        </select>
      </Field>
      <Field label={t('secondaryMuscles')}>
        <select name="secondaryMuscles" multiple size={6} style={{ ...sel, height: 'auto', padding: 8 }}>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>{MUSCLE_LABEL[m]}</option>
          ))}
        </select>
      </Field>
      <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>{t('createExercise')}</Btn>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      {children}
    </label>
  );
}

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ');
const sel: React.CSSProperties = {
  height: 46,
  padding: '0 12px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 15,
  fontFamily: 'var(--font-sans)',
};
