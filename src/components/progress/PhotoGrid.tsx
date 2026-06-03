'use client';

import { useTransition } from 'react';
import { deletePhotoAction } from '@/server/actions/progress';
import { Btn } from '@/components/ui/Btn';

export interface PhotoLite {
  id: string;
  width: number;
  height: number;
  takenAt: string; // ISO date (serialized from the server)
}

export function PhotoGrid({ photos }: { photos: PhotoLite[] }) {
  const [, start] = useTransition();

  function del(id: string) {
    if (!window.confirm('Delete this progress photo? This cannot be undone.')) return;
    start(() => deletePhotoAction(id));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
      {photos.map((p) => (
        <div key={p.id} style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${p.id}`}
            alt={`Progress ${p.takenAt.slice(0, 10)}`}
            width={p.width}
            height={p.height}
            loading="lazy"
            style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}
          />
          <Btn
            kind="soft"
            size="sm"
            icon="x"
            aria-label="Delete photo"
            onClick={() => del(p.id)}
            style={{ position: 'absolute', top: 6, right: 6, height: 30, padding: '0 8px', background: 'color-mix(in oklab, var(--surface) 80%, transparent)' }}
          />
        </div>
      ))}
    </div>
  );
}
