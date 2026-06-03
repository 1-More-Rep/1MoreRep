'use client';

import { useTransition } from 'react';
import { addRoutineItemAction, removeRoutineItemAction, updateRoutineItemAction, reorderRoutineItemsAction } from '@/server/actions/routines';
import { ExercisePicker } from '@/components/exercises/ExercisePicker';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/ui/typography';

export interface EditorItem {
  id: string;
  exerciseName: string;
  supersetGroup: number | null;
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

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--line-2)',
  borderRadius: 'var(--r-sm)',
  height: 38,
  width: 38,
  color: 'var(--text-3)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export function RoutineEditor({ routineId, items }: { routineId: string; items: EditorItem[] }) {
  const [, start] = useTransition();
  const update = (id: string, data: Record<string, number | null>) => start(() => updateRoutineItemAction(id, data));
  const remove = (id: string) => start(() => removeRoutineItemAction(id));
  const add = (exerciseId: string) => addRoutineItemAction(routineId, exerciseId);

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const order = items.map((it) => it.id);
    [order[index], order[j]] = [order[j]!, order[index]!];
    start(() => reorderRoutineItemsAction(routineId, order));
  };

  const toggleSuperset = (index: number) => {
    const it = items[index]!;
    if (it.supersetGroup != null) {
      update(it.id, { supersetGroup: null });
      return;
    }
    const partnerIdx = index < items.length - 1 ? index + 1 : index - 1;
    if (partnerIdx < 0) return;
    const partner = items[partnerIdx]!;
    const group = partner.supersetGroup ?? Math.max(0, ...items.map((i) => i.supersetGroup ?? 0)) + 1;
    start(async () => {
      await updateRoutineItemAction(it.id, { supersetGroup: group });
      await updateRoutineItemAction(partner.id, { supersetGroup: group });
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <SectionLabel>Exercises ({items.length})</SectionLabel>
      {items.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>Add exercises below.</span></Card>}
      {items.map((it, index) => {
        const inSuperset = it.supersetGroup != null;
        const firstOfGroup = inSuperset && (index === 0 || items[index - 1]!.supersetGroup !== it.supersetGroup);
        return (
          <div key={it.id}>
            {firstOfGroup && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>
                <Icon name="repeat" size={13} stroke={2} /> Superset
              </div>
            )}
            <Card style={inSuperset ? { borderLeft: '3px solid var(--accent)' } : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px', fontSize: 15, fontWeight: 600 }}>{it.exerciseName}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <NumberField label="Sets" value={it.targetSets} onCommit={(v) => update(it.id, { targetSets: v })} width={48} />
                  <NumberField label="Rep ↓" value={it.targetRepLow} onCommit={(v) => update(it.id, { targetRepLow: v })} width={48} />
                  <NumberField label="Rep ↑" value={it.targetRepHigh} onCommit={(v) => update(it.id, { targetRepHigh: v })} width={48} />
                  <NumberField label="Rest s" value={it.targetRestSec} onCommit={(v) => update(it.id, { targetRestSec: v })} />
                  <button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${it.exerciseName} up`} style={{ ...iconBtn, opacity: index === 0 ? 0.4 : 1 }}>
                    <Icon name="arrowUp" size={15} />
                  </button>
                  <button onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Move ${it.exerciseName} down`} style={{ ...iconBtn, opacity: index === items.length - 1 ? 0.4 : 1, transform: 'rotate(180deg)' }}>
                    <Icon name="arrowUp" size={15} />
                  </button>
                  <button onClick={() => toggleSuperset(index)} aria-label={inSuperset ? `Clear superset on ${it.exerciseName}` : `Superset ${it.exerciseName}`} aria-pressed={inSuperset} style={{ ...iconBtn, color: inSuperset ? 'var(--accent-text)' : 'var(--text-3)', borderColor: inSuperset ? 'var(--accent-line)' : 'var(--line-2)' }}>
                    <Icon name="repeat" size={15} />
                  </button>
                  <button onClick={() => remove(it.id)} aria-label={`Remove ${it.exerciseName}`} style={iconBtn}>
                    <Icon name="x" size={16} />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        );
      })}
      <ExercisePicker onAdd={add} label="Add exercise" />
    </div>
  );
}
