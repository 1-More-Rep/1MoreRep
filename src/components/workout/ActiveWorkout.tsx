'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  addExerciseAction,
  addSetAction,
  deleteSetAction,
  logSetAction,
  removeEntryAction,
  reorderEntriesAction,
  updateTargetsAction,
  type UIEntry,
} from '@/server/actions/workout';
import { ExercisePicker } from '@/components/exercises/ExercisePicker';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { Icon, IconTile, type IconName } from '@/components/ui/Icon';
import { Mono, SectionLabel } from '@/components/ui/typography';
import { platesPerSide } from '@/domain/progression/plates';
import { FinishModal } from './FinishModal';

export interface ActiveSessionData {
  id: string;
  name: string | null;
  startedAtMs: number;
  fromRoutine: boolean;
  entries: UIEntry[];
}

function fmt(secs: number) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

/** Local (client-side) rest-timer-done notification. Best-effort, permission-gated. */
function notifyRestDone() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) =>
      reg.showNotification('Rest complete', {
        body: 'Time for your next set 💪',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'rest-timer-done',
      }),
    )
    .catch(() => {});
}

export function ActiveWorkout({ session }: { session: ActiveSessionData }) {
  const [entries, setEntries] = useState<UIEntry[]>(session.entries);
  const [, startTx] = useTransition();
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - session.startedAtMs) / 1000));
  const [rest, setRest] = useState<{ ends: number; total: number } | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [finishOpen, setFinishOpen] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - session.startedAtMs) / 1000)), 1000);
    return () => clearInterval(id);
  }, [session.startedAtMs]);

  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((rest.ends - Date.now()) / 1000));
      setRestLeft(left);
      if (left <= 0) {
        setRest(null);
        notifyRestDone();
      }
    }, 250);
    return () => clearInterval(id);
  }, [rest]);

  const doneCount = useMemo(
    () => entries.reduce((n, e) => n + e.sets.filter((s) => s.completed && !s.isWarmup).length, 0),
    [entries],
  );

  function patchSet(entryId: string, setIndex: number, patch: Partial<UIEntry['sets'][number]>) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, sets: e.sets.map((s) => (s.setIndex === setIndex ? { ...s, ...patch } : s)) } : e)));
  }

  function toggleComplete(entry: UIEntry, setIndex: number) {
    const set = entry.sets.find((s) => s.setIndex === setIndex)!;
    const completed = !set.completed;
    patchSet(entry.id, setIndex, { completed });
    startTx(() => logSetAction(entry.id, setIndex, { completed, weightKg: set.weightKg, reps: set.reps }));
    if (completed) setRest({ ends: Date.now() + entry.targetRestSec * 1000, total: entry.targetRestSec });
  }

  function commitField(entry: UIEntry, setIndex: number, field: 'weightKg' | 'reps' | 'rpe', value: number | null) {
    patchSet(entry.id, setIndex, { [field]: value } as Partial<UIEntry['sets'][number]>);
    startTx(() => logSetAction(entry.id, setIndex, { [field]: value }));
  }

  function addSetRow(entry: UIEntry) {
    const nextIdx = (entry.sets.at(-1)?.setIndex ?? 0) + 1;
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, sets: [...e.sets, { setIndex: nextIdx, weightKg: null, reps: null, rpe: null, isWarmup: false, completed: false }] } : e)));
    startTx(() => addSetAction(entry.id));
  }

  function removeSetRow(entry: UIEntry, setIndex: number) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, sets: e.sets.filter((s) => s.setIndex !== setIndex) } : e)));
    startTx(() => deleteSetAction(entry.id, setIndex));
  }

  function removeExercise(entry: UIEntry) {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    startTx(() => removeEntryAction(entry.id));
  }

  async function addExercise(exerciseId: string) {
    const created = await addExerciseAction(session.id, exerciseId);
    setEntries((prev) => [...prev, created]);
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[index], next[j]] = [next[j]!, next[index]!];
    setEntries(next);
    startTx(() => reorderEntriesAction(session.id, next.map((e) => e.id)));
  }

  function toggleSuperset(index: number) {
    const entry = entries[index]!;
    if (entry.supersetGroup != null) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, supersetGroup: null } : e)));
      startTx(() => updateTargetsAction(entry.id, { supersetGroup: null }));
      return;
    }
    const partnerIdx = index < entries.length - 1 ? index + 1 : index - 1;
    if (partnerIdx < 0) return; // nothing to pair with
    const partner = entries[partnerIdx]!;
    const group = partner.supersetGroup ?? Math.max(0, ...entries.map((e) => e.supersetGroup ?? 0)) + 1;
    setEntries((prev) => prev.map((e) => (e.id === entry.id || e.id === partner.id ? { ...e, supersetGroup: group } : e)));
    startTx(async () => {
      await updateTargetsAction(entry.id, { supersetGroup: group });
      await updateTargetsAction(partner.id, { supersetGroup: group });
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* header */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <SectionLabel>In progress</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.015em' }}>{session.name ?? 'Workout'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Chip accent>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--accent)' }} />
              <Mono>{fmt(elapsed)}</Mono>
            </Chip>
            <Chip><Mono>{doneCount}</Mono>&nbsp;sets</Chip>
            <Btn kind="ghost" size="sm" icon="weight" onClick={() => setPlateOpen((v) => !v)}>Plates</Btn>
          </div>
        </div>
        {plateOpen && <PlateCalc />}
      </Card>

      {/* rest timer */}
      {rest && (
        <Card style={{ borderColor: 'var(--accent-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="timer" size={20} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <SectionLabel>Rest</SectionLabel>
                <Mono style={{ fontWeight: 700 }}>{fmt(restLeft)}</Mono>
              </div>
              <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${(restLeft / rest.total) * 100}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
            </div>
            <Btn kind="ghost" size="sm" onClick={() => setRest({ ends: rest.ends + 15000, total: rest.total + 15 })}>+15s</Btn>
            <Btn kind="ghost" size="sm" onClick={() => setRest(null)}>Skip</Btn>
          </div>
        </Card>
      )}

      {/* exercises */}
      {entries.map((entry, index) => {
        const inSuperset = entry.supersetGroup != null;
        const firstOfGroup = inSuperset && (index === 0 || entries[index - 1]!.supersetGroup !== entry.supersetGroup);
        return (
        <div key={entry.id}>
          {firstOfGroup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>
              <Icon name="repeat" size={13} stroke={2} /> Superset
            </div>
          )}
        <Card pad={false} style={inSuperset ? { borderLeft: '3px solid var(--accent)' } : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--pad)' }}>
            <IconTile name={entry.iconKey as IconName} variant="soft" size={40} icon={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{entry.exerciseName}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                target {entry.targetSets} × {entry.targetRepLow}–{entry.targetRepHigh} · {entry.targetRestSec}s
              </div>
            </div>
            <button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${entry.exerciseName} up`} style={{ ...iconBtn, opacity: index === 0 ? 0.4 : 1 }}>
              <Icon name="arrowUp" size={15} />
            </button>
            <button onClick={() => move(index, 1)} disabled={index === entries.length - 1} aria-label={`Move ${entry.exerciseName} down`} style={{ ...iconBtn, opacity: index === entries.length - 1 ? 0.4 : 1, transform: 'rotate(180deg)' }}>
              <Icon name="arrowUp" size={15} />
            </button>
            <button onClick={() => toggleSuperset(index)} aria-label={inSuperset ? `Clear superset on ${entry.exerciseName}` : `Superset ${entry.exerciseName}`} aria-pressed={inSuperset} style={{ ...iconBtn, color: inSuperset ? 'var(--accent-text)' : 'var(--text-3)', borderColor: inSuperset ? 'var(--accent-line)' : 'var(--line-2)' }}>
              <Icon name="repeat" size={15} />
            </button>
            <button onClick={() => removeExercise(entry)} aria-label={`Remove ${entry.exerciseName}`} style={iconBtn}>
              <Icon name="x" size={16} />
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 52px 44px', gap: 8, padding: '8px var(--pad)', fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Set</span><span>kg</span><span>reps</span><span>RPE</span><span></span>
            </div>
            {entry.sets.map((s) => (
              <div key={s.setIndex} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 52px 44px', gap: 8, padding: '6px var(--pad)', alignItems: 'center', borderTop: '1px solid var(--line)', opacity: s.completed ? 0.7 : 1 }}>
                <Mono style={{ fontSize: 13, color: 'var(--text-3)' }}>{s.setIndex}</Mono>
                <input type="number" inputMode="decimal" aria-label={`weight set ${s.setIndex}`} defaultValue={s.weightKg ?? ''} onBlur={(e) => commitField(entry, s.setIndex, 'weightKg', e.target.value === '' ? null : Number(e.target.value))} style={cell} />
                <input type="number" inputMode="numeric" aria-label={`reps set ${s.setIndex}`} defaultValue={s.reps ?? ''} onBlur={(e) => commitField(entry, s.setIndex, 'reps', e.target.value === '' ? null : Number(e.target.value))} style={cell} />
                <input type="number" inputMode="decimal" aria-label={`rpe set ${s.setIndex}`} defaultValue={s.rpe ?? ''} onBlur={(e) => commitField(entry, s.setIndex, 'rpe', e.target.value === '' ? null : Number(e.target.value))} style={{ ...cell, fontSize: 12 }} />
                <button onClick={() => toggleComplete(entry, s.setIndex)} aria-label={`complete set ${s.setIndex}`} aria-pressed={s.completed} style={{ width: 30, height: 30, borderRadius: 'var(--r-xs)', border: `1.6px solid ${s.completed ? 'var(--accent)' : 'var(--line-2)'}`, background: s.completed ? 'var(--accent)' : 'transparent', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', justifySelf: 'center' }}>
                  {s.completed && <Icon name="check" size={15} stroke={2.6} />}
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, padding: '10px var(--pad)', borderTop: '1px solid var(--line)' }}>
              <Btn kind="ghost" size="sm" icon="plus" onClick={() => addSetRow(entry)}>Add set</Btn>
              {entry.sets.length > 1 && (
                <Btn kind="ghost" size="sm" onClick={() => removeSetRow(entry, entry.sets.at(-1)!.setIndex)}>Remove set</Btn>
              )}
            </div>
          </div>
        </Card>
        </div>
        );
      })}

      <ExercisePicker onAdd={addExercise} label="Add exercise" />

      <div style={{ position: 'sticky', bottom: 12, marginTop: 8 }}>
        <Btn kind="primary" full size="lg" icon="check" onClick={() => setFinishOpen(true)}>Finish workout</Btn>
      </div>

      {finishOpen && (
        <FinishModal
          sessionId={session.id}
          fromRoutine={session.fromRoutine}
          defaultName={session.name ?? 'New routine'}
          durationSec={elapsed}
          onClose={() => setFinishOpen(false)}
        />
      )}
    </div>
  );
}

function PlateCalc() {
  const [w, setW] = useState(100);
  const plates = platesPerSide(w);
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
        Target
        <input type="number" value={w} onChange={(e) => setW(Number(e.target.value) || 0)} style={{ ...cell, width: 80 }} />
        kg
      </label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {plates.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Bar only / below bar</span>
        ) : (
          plates.map((p, i) => <Chip key={i}><Mono>{p}</Mono></Chip>)
        )}
        <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>per side (20kg bar)</span>
      </div>
    </div>
  );
}

const cell: React.CSSProperties = {
  height: 34,
  width: '100%',
  padding: '0 8px',
  borderRadius: 'var(--r-xs)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font-mono)',
  textAlign: 'center',
};
const iconBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--line-2)',
  borderRadius: 'var(--r-sm)',
  height: 34,
  width: 34,
  color: 'var(--text-3)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
