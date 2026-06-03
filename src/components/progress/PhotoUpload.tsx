'use client';

import { useActionState, useRef } from 'react';
import { uploadPhotoAction, type ProgressState } from '@/server/actions/progress';
import { Btn } from '@/components/ui/Btn';
import { Alert } from '@/components/auth/ui';

export function PhotoUpload() {
  const [state, action] = useActionState(uploadPhotoAction, {} as ProgressState);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Alert kind="error">{state.error}</Alert>
      <Alert kind="notice">{state.notice}</Alert>
      <input
        ref={ref}
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Progress photo"
        style={{ fontSize: 14, color: 'var(--text-2)' }}
      />
      <Btn type="submit" icon="plus" style={{ alignSelf: 'flex-start' }}>Upload photo</Btn>
      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Stored privately. Images are re-encoded (EXIF/location stripped) and only visible to you.</p>
    </form>
  );
}
