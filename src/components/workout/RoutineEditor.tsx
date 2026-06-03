'use client';

import { useTransition } from 'react';
import { addRoutineItemAction, removeRoutineItemAction, updateRoutineItemAction } from '@/server/actions/routines';
import { ExercisePicker } from '@/components/exercises/ExercisePicker';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/ui/typography';

export interface EditorItem {
  id: string;
  exerciseName: string;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  targetRestSec: number;
}

function NumberField({ label, value, onCommit, width = 56 }: { label: string; value: number; onCommit: (v: number) => void; width?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
      <input
        type="number"
        defaultValue={value}
        min={0}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v) && v !== value) onCommit(v);
        }}
        style={{ width, height: 38, padding: '0 8px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
      />
    </label>
  );
}

export function RoutineEditor({ routineId, items }: { routineId: string; items: EditorItem[] }) {
  const [, start] = useTransition();
  const update = (id: string, data: Record<string, number>) => start(() => updateRoutineItemAction(id, data));
  const remove = (id: string) => start(() => removeRoutineItemAction(id));
  const add = (exerciseId: string) => addRoutineItemAction(routineId, exerciseId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <SectionLabel>Exercises ({items.length})</SectionLabel>
      {items.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>Add exercises below.</span></Card>}
      {items.map((it) => (
        <Card key={it.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px', fontSize: 15, fontWeight: 600 }}>{it.exerciseName}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <NumberField label="Sets" value={it.targetSets} onCommit={(v) => update(it.id, { targetSets: v })} width={48} />
              <NumberField label="Rep ↓" value={it.targetRepLow} onCommit={(v) => update(it.id, { targetRepLow: v })} width={48} />
              <NumberField label="Rep ↑" value={it.targetRepHigh} onCommit={(v) => update(it.id, { targetRepHigh: v })} width={48} />
              <NumberField label="Rest s" value={it.targetRestSec} onCommit={(v) => update(it.id, { targetRestSec: v })} />
              <button onClick={() => remove(it.id)} aria-label={`Remove ${it.exerciseName}`} style={{ background: 'none', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', height: 38, width: 38, color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
        </Card>
      ))}
      <ExercisePicker onAdd={add} label="Add exercise" />
    </div>
  );
}
