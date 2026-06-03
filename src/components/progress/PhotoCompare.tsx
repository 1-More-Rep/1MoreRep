'use client';

import { useState } from 'react';
import type { PhotoLite } from './PhotoGrid';

const selectStyle: React.CSSProperties = {
  height: 38,
  padding: '0 10px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
};

/** Before/after compare slider with a draggable divider and keyboard range fallback. */
export function PhotoCompare({ photos }: { photos: PhotoLite[] }) {
  const sorted = [...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const [beforeId, setBeforeId] = useState(sorted[0]!.id);
  const [afterId, setAfterId] = useState(sorted[sorted.length - 1]!.id);
  const [pos, setPos] = useState(50); // % of the "before" image revealed

  const label = (p: PhotoLite) => p.takenAt.slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
          Before
          <select aria-label="Before photo" value={beforeId} onChange={(e) => setBeforeId(e.target.value)} style={selectStyle}>
            {sorted.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
          After
          <select aria-label="After photo" value={afterId} onChange={(e) => setAfterId(e.target.value)} style={selectStyle}>
            {sorted.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
          </select>
        </label>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '3 / 4', borderRadius: 'var(--r-sm)', overflow: 'hidden', border: '1px solid var(--line)', userSelect: 'none' }}>
        {/* after = base layer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/photos/${afterId}`} alt="After" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* before = clipped overlay */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/photos/${beforeId}`}
          alt="Before"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, background: 'var(--accent)', transform: 'translateX(-1px)' }} />
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare position"
        style={{ width: '100%', maxWidth: 360, accentColor: 'var(--accent)' }}
      />
    </div>
  );
}
