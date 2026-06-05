'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setRoutineArchivedAction } from '@/server/actions/routines';
import { Btn, useToast } from '@/components/ui';

/** Restore an archived routine back to the active list. */
export function UnarchiveButton({ routineId, name }: { routineId: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Btn
      kind="soft"
      size="sm"
      icon="repeat"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setRoutineArchivedAction(routineId, false);
          toast(`Restored “${name}”.`, 'success');
          router.refresh();
        })
      }
    >
      {pending ? 'Restoring…' : 'Restore'}
    </Btn>
  );
}
