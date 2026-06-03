'use client';

import { useEffect, useState, useTransition } from 'react';
import { finishWorkoutAction, getWorkoutDiffAction } from '@/server/actions/workout';
import type { RoutineDiff } from '@/domain/routine/diff';
import type { SaveMode } from '@/server/services/sessionService';
import { Btn } from '@/components/ui/Btn';
import { SectionLabel } from '@/components/ui/typography';

export function FinishModal({
  sessionId,
  fromRoutine,
  defaultName,
  durationSec,
  onClose,
}: {
  sessionId: string;
  fromRoutine: boolean;
  defaultName: string;
  durationSec: number;
  onClose: () => void;
}) {
  const [diff, setDiff] = useState<RoutineDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState('');
  const [pending, startTx] = useTransition();

  useEffect(() => {
    if (!fromRoutine) {
      setLoading(false);
      return;
    }
    getWorkoutDiffAction(sessionId)
      .then(setDiff)
      .finally(() => setLoading(false));
  }, [sessionId, fromRoutine]);

  function finish(saveMode: SaveMode) {
    startTx(() => finishWorkoutAction(sessionId, { saveMode, newRoutineName: name, durationSec, notes: notes.trim() || undefined }));
  }

  const dirty = diff?.isDirty ?? false;

  return (
    <div role="dialog" aria-modal="true" aria-label="Finish workout" style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Finish workout</h2>

        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>Checking changes…</p>
        ) : fromRoutine && dirty ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 14px' }}>
              You changed this workout. Save the changes back to the routine?
            </p>
            {diff && <DiffSummary diff={diff} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <Btn full icon="check" disabled={pending} onClick={() => finish('UPDATE_ROUTINE')}>Save changes to routine</Btn>
              <Btn kind="soft" full disabled={pending} onClick={() => finish('NEW_ROUTINE')}>Save as a new routine</Btn>
              <Btn kind="ghost" full disabled={pending} onClick={() => finish('NONE')}>Don&apos;t save changes</Btn>
            </div>
          </>
        ) : fromRoutine ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 14px' }}>No changes to the routine. Finish and log this session?</p>
            <Btn full icon="check" disabled={pending} onClick={() => finish('NONE')}>Finish</Btn>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 14px' }}>Save these exercises as a new routine?</p>
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Routine name" placeholder="Routine name" style={input} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <Btn full icon="check" disabled={pending} onClick={() => finish('NEW_ROUTINE')}>Save as new routine</Btn>
              <Btn kind="ghost" full disabled={pending} onClick={() => finish('NONE')}>Just finish</Btn>
            </div>
          </>
        )}

        {!loading && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            <SectionLabel>Notes (optional)</SectionLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel? Anything to remember next time…"
              rows={2}
              style={{ ...input, height: 'auto', minHeight: 56, padding: 10, resize: 'vertical', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}
            />
          </label>
        )}

        <button onClick={onClose} disabled={pending} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', width: '100%' }}>
          Keep training
        </button>
      </div>
    </div>
  );
}

function DiffSummary({ diff }: { diff: RoutineDiff }) {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`${diff.added.length} added`);
  if (diff.removed.length) parts.push(`${diff.removed.length} removed`);
  if (diff.modified.length) parts.push(`${diff.modified.length} changed`);
  if (diff.reordered) parts.push('reordered');
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 12 }}>
      <SectionLabel>Changes</SectionLabel>
      <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6 }}>{parts.join(' · ') || 'None'}</div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.4)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 50,
  padding: 16,
};
const sheet: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow)',
  padding: 'calc(var(--pad) * 1.2)',
  width: '100%',
  maxWidth: 440,
  marginBottom: 'env(safe-area-inset-bottom, 0)',
};
const input: React.CSSProperties = {
  height: 46,
  width: '100%',
  padding: '0 14px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 15,
};
