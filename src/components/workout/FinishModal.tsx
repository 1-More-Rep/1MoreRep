'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('workout');
  const [diff, setDiff] = useState<RoutineDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTx] = useTransition();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!fromRoutine) {
      setLoading(false);
      return;
    }
    getWorkoutDiffAction(sessionId)
      .then(setDiff)
      .finally(() => setLoading(false));
  }, [sessionId, fromRoutine]);

  // Dialog a11y (WCAG 2.1.2 / 2.4.3): initial focus, focus trap, Escape, focus restore.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const focusables = () => {
      const root = sheetRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    };
    focusables()[0]?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0]!;
        const last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, []);

  function finish(saveMode: SaveMode) {
    setErr(null);
    startTx(async () => {
      try {
        // On success this server action redirects, which resolves the client promise via
        // navigation (no throw here); a real failure rejects and is surfaced below.
        await finishWorkoutAction(sessionId, { saveMode, newRoutineName: name, durationSec, notes: notes.trim() || undefined });
      } catch {
        setErr(t('finishError'));
      }
    });
  }

  const dirty = diff?.isDirty ?? false;

  return (
    <div role="dialog" aria-modal="true" aria-label={t('finishWorkout')} style={overlay} onClick={onClose}>
      <div ref={sheetRef} style={sheet} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>{t('finishWorkout')}</h2>

        {loading ? (
          <p style={{ color: 'var(--text-3)' }}>{t('checkingChanges')}</p>
        ) : fromRoutine && dirty ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 14px' }}>
              {t('changedPrompt')}
            </p>
            {diff && <DiffSummary diff={diff} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <Btn full icon="check" disabled={pending} onClick={() => finish('UPDATE_ROUTINE')}>{t('saveChangesToRoutine')}</Btn>
              <Btn kind="soft" full disabled={pending} onClick={() => finish('NEW_ROUTINE')}>{t('saveAsNewRoutineLong')}</Btn>
              <Btn kind="ghost" full disabled={pending} onClick={() => finish('NONE')}>{t('dontSaveChanges')}</Btn>
            </div>
          </>
        ) : fromRoutine ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 14px' }}>{t('noChangesPrompt')}</p>
            <Btn full icon="check" disabled={pending} onClick={() => finish('NONE')}>{t('finish')}</Btn>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 14px' }}>{t('saveAsRoutinePrompt')}</p>
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('routineName')} placeholder={t('routineName')} style={input} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <Btn full icon="check" disabled={pending} onClick={() => finish('NEW_ROUTINE')}>{t('saveAsNewRoutine')}</Btn>
              <Btn kind="ghost" full disabled={pending} onClick={() => finish('NONE')}>{t('justFinish')}</Btn>
            </div>
          </>
        )}

        {!loading && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            <SectionLabel>{t('notesOptional')}</SectionLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              rows={2}
              style={{ ...input, height: 'auto', minHeight: 56, padding: 10, resize: 'vertical', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}
            />
          </label>
        )}

        {err && (
          <div role="alert" style={{ marginTop: 12, fontSize: 13, color: '#c0392b', lineHeight: 1.4 }}>
            {err}
          </div>
        )}

        <button onClick={onClose} disabled={pending} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', width: '100%' }}>
          {t('keepTraining')}
        </button>
      </div>
    </div>
  );
}

function DiffSummary({ diff }: { diff: RoutineDiff }) {
  const t = useTranslations('workout');
  const parts: string[] = [];
  if (diff.added.length) parts.push(t('diffAdded', { count: diff.added.length }));
  if (diff.removed.length) parts.push(t('diffRemoved', { count: diff.removed.length }));
  if (diff.modified.length) parts.push(t('diffChanged', { count: diff.modified.length }));
  if (diff.reordered) parts.push(t('diffReordered'));
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 12 }}>
      <SectionLabel>{t('changes')}</SectionLabel>
      <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6 }}>{parts.join(' · ') || t('diffNone')}</div>
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
  // Cap height + scroll so the diff-review variant (summary + 3 buttons + notes) never
  // overflows the overlay and clips its content/actions on short viewports (e.g. iPhone SE).
  maxHeight: 'calc(100dvh - 32px)',
  overflowY: 'auto',
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
