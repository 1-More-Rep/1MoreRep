'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateRoutineAction } from '@/server/actions/routines';
import { Select, Textarea, useToast } from '@/components/ui';

type GoalValue = '' | 'HYPERTROPHY' | 'STRENGTH' | 'ENDURANCE' | 'GENERAL';

export function RoutineHeaderEditor({
  routineId,
  name: initialName,
  goal: initialGoal,
  notes: initialNotes,
}: {
  routineId: string;
  name: string;
  goal: GoalValue;
  notes: string;
}) {
  const t = useTranslations('routine');
  const { toast } = useToast();
  const [, start] = useTransition();
  const [name, setName] = useState(initialName);
  const [goal, setGoal] = useState<GoalValue>(initialGoal);
  const [notes, setNotes] = useState(initialNotes);

  const GOAL_OPTIONS: { value: GoalValue; label: string }[] = [
    { value: '', label: t('goalNone') },
    { value: 'HYPERTROPHY', label: t('goalHypertrophy') },
    { value: 'STRENGTH', label: t('goalStrength') },
    { value: 'ENDURANCE', label: t('goalEndurance') },
    { value: 'GENERAL', label: t('goalGeneral') },
  ];

  function commit(patch: { name?: string; goal?: GoalValue; notes?: string }, successMsg?: string) {
    start(async () => {
      const r = await updateRoutineAction(routineId, patch);
      if (r.error) toast(r.error, 'error');
      else if (successMsg) toast(successMsg, 'success');
    });
  }

  function commitName() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setName(initialName); // revert invalid
      toast(t('nameTooShort'), 'error');
      return;
    }
    if (trimmed !== initialName) commit({ name: trimmed }, t('renamed'));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        aria-label={t('routineName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        maxLength={60}
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-.02em',
          border: '1px solid transparent',
          borderRadius: 'var(--r-sm)',
          padding: '4px 8px',
          margin: '0 -8px',
          background: 'transparent',
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
          width: '100%',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--line-2)';
          e.target.style.background = 'var(--surface)';
        }}
      />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Select<GoalValue>
            label={t('goal')}
            ariaLabel="Routine goal"
            value={goal}
            onChange={(g) => {
              setGoal(g);
              commit({ goal: g }, t('goalUpdated'));
            }}
            options={GOAL_OPTIONS}
          />
        </div>
      </div>
      <Textarea
        label={t('notes')}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes.trim() !== initialNotes) commit({ notes: notes.trim() }, t('notesSaved'));
        }}
        rows={2}
        maxLength={2000}
        placeholder={t('notesPlaceholder')}
      />
    </div>
  );
}
