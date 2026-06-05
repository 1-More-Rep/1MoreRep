'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setRoutineArchivedAction } from '@/server/actions/routines';
import { Btn, Sheet, useToast } from '@/components/ui';

/** Archive a routine behind a confirm step (soft-delete; recoverable from Archived). */
export function ArchiveRoutineButton({ routineId, name }: { routineId: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function archive() {
    start(async () => {
      await setRoutineArchivedAction(routineId, true);
      toast(`Archived “${name}”.`, 'info');
      setOpen(false);
      router.push('/app/workouts');
    });
  }

  return (
    <>
      <Btn type="button" kind="ghost" size="sm" icon="trash" onClick={() => setOpen(true)} style={{ color: 'var(--text-3)' }}>
        Archive routine
      </Btn>
      <Sheet open={open} onClose={() => setOpen(false)} title="Archive routine?">
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 0 }}>
          “{name}” will be hidden from your routines. Your workout history is kept, and you can restore it
          anytime from <strong>Archived routines</strong>.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Btn kind="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn icon="trash" onClick={archive} disabled={pending}>{pending ? 'Archiving…' : 'Archive'}</Btn>
        </div>
      </Sheet>
    </>
  );
}
