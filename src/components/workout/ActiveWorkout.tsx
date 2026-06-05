'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
import { weightUnit, toKg, weightInputValue, type UnitSystemLike } from '@/domain/units';
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
function notifyRestDone(title: string, body: string) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) =>
      reg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        // Monochrome transparent badge for the Android status bar (see public/sw.js).
        badge: '/icons/badge-96.png',
        tag: 'rest-timer-done',
      }),
    )
    .catch(() => {});
}

export function ActiveWorkout({ session, unitSystem }: { session: ActiveSessionData; unitSystem: UnitSystemLike }) {
  const t = useTranslations('workout');
  const [entries, setEntries] = useState<UIEntry[]>(session.entries);
  const wUnit = weightUnit(unitSystem);
  const [, startTx] = useTransition();
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - session.startedAtMs) / 1000));
  const [rest, setRest] = useState<{ ends: number; total: number } | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [finishOpen, setFinishOpen] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  // Wrap every optimistic mutation: on failure the local state has already diverged from
  // the server, so surface a visible, recoverable error (refresh re-syncs) instead of
  // silently dropping the change.
  function run(fn: () => Promise<unknown>) {
    startTx(async () => {
      try {
        await fn();
        setSyncErr(null);
      } catch {
        setSyncErr(t('syncErrorSave'));
      }
    });
  }

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
        notifyRestDone(t('restCompleteTitle'), t('restCompleteBody'));
      }
    }, 250);
    return () => clearInterval(id);
  }, [rest, t]);

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
    // Send only `completed`: weight/reps are persisted by commitField on blur, which fires
    // before this click. Re-sending them here would write the STALE closure values captured
    // at render time (before the just-typed value reached state), overwriting the real input.
    run(() => logSetAction(entry.id, setIndex, { completed }));
    if (completed) setRest({ ends: Date.now() + entry.targetRestSec * 1000, total: entry.targetRestSec });
  }

  function commitField(entry: UIEntry, setIndex: number, field: 'weightKg' | 'reps' | 'rpe', value: number | null) {
    patchSet(entry.id, setIndex, { [field]: value } as Partial<UIEntry['sets'][number]>);
    run(() => logSetAction(entry.id, setIndex, { [field]: value }));
  }

  function addSetRow(entry: UIEntry) {
    const nextIdx = (entry.sets.at(-1)?.setIndex ?? 0) + 1;
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, sets: [...e.sets, { setIndex: nextIdx, weightKg: null, reps: null, rpe: null, isWarmup: false, completed: false }] } : e)));
    run(() => addSetAction(entry.id));
  }

  function removeSetRow(entry: UIEntry, setIndex: number) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, sets: e.sets.filter((s) => s.setIndex !== setIndex) } : e)));
    run(() => deleteSetAction(entry.id, setIndex));
  }

  function removeExercise(entry: UIEntry) {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    run(() => removeEntryAction(entry.id));
  }

  async function addExercise(exerciseId: string) {
    try {
      const created = await addExerciseAction(session.id, exerciseId);
      setEntries((prev) => [...prev, created]);
      setSyncErr(null);
    } catch {
      setSyncErr(t('syncErrorAdd'));
    }
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[index], next[j]] = [next[j]!, next[index]!];
    setEntries(next);
    run(() => reorderEntriesAction(session.id, next.map((e) => e.id)));
  }

  function toggleSuperset(index: number) {
    const entry = entries[index]!;
    if (entry.supersetGroup != null) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, supersetGroup: null } : e)));
      run(() => updateTargetsAction(entry.id, { supersetGroup: null }));
      return;
    }
    const partnerIdx = index < entries.length - 1 ? index + 1 : index - 1;
    if (partnerIdx < 0) return; // nothing to pair with
    const partner = entries[partnerIdx]!;
    const group = partner.supersetGroup ?? Math.max(0, ...entries.map((e) => e.supersetGroup ?? 0)) + 1;
    setEntries((prev) => prev.map((e) => (e.id === entry.id || e.id === partner.id ? { ...e, supersetGroup: group } : e)));
    run(async () => {
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
            <SectionLabel>{t('inProgress')}</SectionLabel>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.015em' }}>{session.name ?? t('workoutFallback')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Chip accent>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--accent)' }} />
              <Mono>{fmt(elapsed)}</Mono>
            </Chip>
            <Chip><Mono>{doneCount}</Mono>&nbsp;{t('setsLabel')}</Chip>
            <Btn kind="ghost" size="sm" icon="weight" onClick={() => setPlateOpen((v) => !v)}>{t('plates')}</Btn>
          </div>
        </div>
        {plateOpen && <PlateCalc />}
      </Card>

      {/* sync error — a server action failed; local state has diverged, offer a re-sync */}
      {syncErr && (
        <Card style={{ borderColor: 'color-mix(in oklab, #d23b3b 30%, var(--surface))' }}>
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#c0392b' }}>
            <Icon name="x" size={16} />
            <span style={{ flex: 1 }}>{syncErr}</span>
            <Btn kind="ghost" size="sm" onClick={() => window.location.reload()}>{t('refresh')}</Btn>
          </div>
        </Card>
      )}

      {/* rest timer */}
      {rest && (
        <Card style={{ borderColor: 'var(--accent-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="timer" size={20} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <SectionLabel>{t('rest')}</SectionLabel>
                <Mono style={{ fontWeight: 700 }}>{fmt(restLeft)}</Mono>
              </div>
              <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${(restLeft / rest.total) * 100}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
            </div>
            <Btn kind="ghost" size="sm" onClick={() => setRest({ ends: rest.ends + 15000, total: rest.total + 15 })}>{t('restAdd15')}</Btn>
            <Btn kind="ghost" size="sm" onClick={() => setRest(null)}>{t('skip')}</Btn>
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
              <Icon name="repeat" size={13} stroke={2} /> {t('superset')}
            </div>
          )}
        <Card pad={false} style={inSuperset ? { borderLeft: '3px solid var(--accent)' } : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--pad)' }}>
            <IconTile name={entry.iconKey as IconName} variant="soft" size={40} icon={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{entry.exerciseName}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                {t('targetLine', { sets: entry.targetSets, low: entry.targetRepLow, high: entry.targetRepHigh, rest: entry.targetRestSec })}
              </div>
            </div>
            <button onClick={() => move(index, -1)} disabled={index === 0} aria-label={t('moveUp', { name: entry.exerciseName })} style={{ ...iconBtn, opacity: index === 0 ? 0.4 : 1 }}>
              <Icon name="arrowUp" size={15} />
            </button>
            <button onClick={() => move(index, 1)} disabled={index === entries.length - 1} aria-label={t('moveDown', { name: entry.exerciseName })} style={{ ...iconBtn, opacity: index === entries.length - 1 ? 0.4 : 1, transform: 'rotate(180deg)' }}>
              <Icon name="arrowUp" size={15} />
            </button>
            <button onClick={() => toggleSuperset(index)} aria-label={inSuperset ? t('clearSuperset', { name: entry.exerciseName }) : t('supersetExercise', { name: entry.exerciseName })} aria-pressed={inSuperset} style={{ ...iconBtn, color: inSuperset ? 'var(--accent-text)' : 'var(--text-3)', borderColor: inSuperset ? 'var(--accent-line)' : 'var(--line-2)' }}>
              <Icon name="repeat" size={15} />
            </button>
            <button onClick={() => removeExercise(entry)} aria-label={t('removeExercise', { name: entry.exerciseName })} style={iconBtn}>
              <Icon name="x" size={16} />
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 52px 44px', gap: 8, padding: '8px var(--pad)', fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>{t('colSet')}</span><span>{wUnit}</span><span>{t('colReps')}</span><span>{t('colRpe')}</span><span></span>
            </div>
            {entry.sets.map((s) => (
              <div key={s.setIndex} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 52px 44px', gap: 8, padding: '6px var(--pad)', alignItems: 'center', borderTop: '1px solid var(--line)', opacity: s.completed ? 0.7 : 1 }}>
                <Mono style={{ fontSize: 13, color: 'var(--text-3)' }}>{s.setIndex}</Mono>
                {/* Input shows + accepts the user's unit (lb for IMPERIAL); toKg converts back
                    to canonical kg on commit so storage is always kg. */}
                <input type="number" inputMode="decimal" aria-label={t('ariaWeightSet', { index: s.setIndex, unit: wUnit })} defaultValue={weightInputValue(s.weightKg, unitSystem)} onBlur={(e) => commitField(entry, s.setIndex, 'weightKg', e.target.value === '' ? null : toKg(Number(e.target.value), unitSystem))} style={cell} />
                <input type="number" inputMode="numeric" aria-label={t('ariaRepsSet', { index: s.setIndex })} defaultValue={s.reps ?? ''} onBlur={(e) => commitField(entry, s.setIndex, 'reps', e.target.value === '' ? null : Number(e.target.value))} style={cell} />
                <input type="number" inputMode="decimal" aria-label={t('ariaRpeSet', { index: s.setIndex })} defaultValue={s.rpe ?? ''} onBlur={(e) => commitField(entry, s.setIndex, 'rpe', e.target.value === '' ? null : Number(e.target.value))} style={{ ...cell, fontSize: 12 }} />
                <button onClick={() => toggleComplete(entry, s.setIndex)} aria-label={t('ariaCompleteSet', { index: s.setIndex })} aria-pressed={s.completed} style={{ width: 30, height: 30, borderRadius: 'var(--r-xs)', border: `1.6px solid ${s.completed ? 'var(--accent)' : 'var(--line-2)'}`, background: s.completed ? 'var(--accent)' : 'transparent', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', justifySelf: 'center' }}>
                  {s.completed && <Icon name="check" size={15} stroke={2.6} />}
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, padding: '10px var(--pad)', borderTop: '1px solid var(--line)' }}>
              <Btn kind="ghost" size="sm" icon="plus" onClick={() => addSetRow(entry)}>{t('addSet')}</Btn>
              {entry.sets.length > 1 && (
                <Btn kind="ghost" size="sm" onClick={() => removeSetRow(entry, entry.sets.at(-1)!.setIndex)}>{t('removeSet')}</Btn>
              )}
            </div>
          </div>
        </Card>
        </div>
        );
      })}

      <ExercisePicker onAdd={addExercise} label={t('addExerciseLabel')} />

      <div style={{ position: 'sticky', bottom: 12, marginTop: 8 }}>
        <Btn kind="primary" full size="lg" icon="check" onClick={() => setFinishOpen(true)}>{t('finishWorkout')}</Btn>
      </div>

      {finishOpen && (
        <FinishModal
          sessionId={session.id}
          fromRoutine={session.fromRoutine}
          defaultName={session.name ?? t('newRoutineDefault')}
          durationSec={elapsed}
          onClose={() => setFinishOpen(false)}
        />
      )}
    </div>
  );
}

function PlateCalc() {
  const t = useTranslations('workout');
  const [w, setW] = useState(100);
  const plates = platesPerSide(w);
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
        {t('plateTarget')}
        <input type="number" value={w} onChange={(e) => setW(Number(e.target.value) || 0)} style={{ ...cell, width: 80 }} aria-label={t('plateTarget')} />
        kg
      </label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {plates.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('plateBarOnly')}</span>
        ) : (
          plates.map((p, i) => <Chip key={i}><Mono>{p}</Mono></Chip>)
        )}
        <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>{t('platePerSide')}</span>
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
