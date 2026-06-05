'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { searchExercisesAction, type PickerExercise } from '@/server/actions/exercises';
import { IconTile, type IconName } from '@/components/ui/Icon';
import { Btn } from '@/components/ui/Btn';

/**
 * Search + add an exercise. `onAdd` is a bound server action (e.g.
 * addRoutineItemAction.bind(null, routineId)).
 */
export function ExercisePicker({ onAdd, label }: { onAdd: (exerciseId: string) => Promise<void>; onAddLabel?: string; label?: string }) {
  const t = useTranslations('exercises');
  const addLabel = label ?? t('addExercise');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickerExercise[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      searchExercisesAction(q).then(setResults).catch(() => setResults([]));
    }, 180);
    return () => clearTimeout(id);
  }, [q, open]);

  if (!open) {
    return (
      <Btn kind="soft" icon="plus" onClick={() => setOpen(true)}>
        {addLabel}
      </Btn>
    );
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, padding: 'var(--pad)', borderBottom: '1px solid var(--line)' }}>
        <input
          autoFocus
          type="search"
          value={q}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchToAddAria')}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, height: 42, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14.5 }}
        />
        <Btn kind="ghost" icon="x" onClick={() => setOpen(false)} aria-label={t('close')} />
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto' }}>
        {results.length === 0 && <div style={{ padding: 'var(--pad)', color: 'var(--text-3)', fontSize: 14 }}>{t('typeToSearch')}</div>}
        {results.map((ex) => (
          <button
            key={ex.id}
            disabled={pending}
            onClick={() => start(async () => { await onAdd(ex.id); setOpen(false); setQ(''); })}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 'var(--row) var(--pad)', background: 'none', border: 'none', borderTop: '1px solid var(--line)', cursor: 'pointer', color: 'var(--text)', textAlign: 'left' }}
          >
            <IconTile name={ex.iconKey as IconName} variant="soft" size={36} icon={18} />
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{ex.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{ex.equipment.toLowerCase().replace('_', ' ')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
