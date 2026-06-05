'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { duplicateRoutineAction, setRoutineArchivedAction } from '@/server/actions/routines';
import { Btn, Icon, Sheet, useToast } from '@/components/ui';

/** Per-routine overflow menu on the list: Edit, Duplicate, Archive (confirmed). */
export function RoutineCardMenu({ routineId, name }: { routineId: string; name: string }) {
  const t = useTranslations('routine');
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, start] = useTransition();

  function duplicate() {
    start(async () => {
      // The action redirects to the new routine's editor on success.
      await duplicateRoutineAction(routineId);
    });
  }

  function archive() {
    start(async () => {
      await setRoutineArchivedAction(routineId, true);
      toast(t('archived', { name }), 'info');
      setConfirmArchive(false);
      setOpen(false);
      router.refresh();
    });
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    minHeight: 50,
    padding: '8px 6px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    textAlign: 'left',
  };

  return (
    <>
      <button
        type="button"
        aria-label={t('manage', { name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--line-2)',
          background: 'var(--surface)',
          color: 'var(--text-3)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="more" size={18} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={name}>
        {confirmArchive ? (
          <div>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 0 }}>
              {t('confirmArchiveShort', { name })}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn kind="ghost" onClick={() => setConfirmArchive(false)}>{t('cancel')}</Btn>
              <Btn icon="trash" onClick={archive} disabled={pending}>{pending ? t('archiving') : t('archive')}</Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button type="button" style={rowStyle} onClick={() => router.push(`/app/workouts/${routineId}`)}>
              <Icon name="edit" size={18} stroke={1.9} /> {t('edit')}
            </button>
            <button type="button" style={rowStyle} onClick={duplicate} disabled={pending}>
              <Icon name="copy" size={18} stroke={1.9} /> {t('duplicate')}
            </button>
            <button type="button" style={{ ...rowStyle, color: 'var(--text-2)' }} onClick={() => setConfirmArchive(true)}>
              <Icon name="trash" size={18} stroke={1.9} /> {t('archive')}
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
