'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { MUSCLES, MUSCLE_LABEL } from '@/domain/muscles/taxonomy';

const EQUIPMENT = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND', 'EZ_BAR', 'BALL', 'OTHER'];

export function ExerciseFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`/app/exercises?${next.toString()}`));
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', opacity: pending ? 0.6 : 1 }}>
      <input
        type="search"
        placeholder="Search exercises…"
        defaultValue={sp.get('q') ?? ''}
        aria-label="Search exercises"
        onChange={(e) => setParam('q', e.target.value)}
        style={{ ...input, flex: '1 1 220px' }}
      />
      <select aria-label="Muscle" value={sp.get('muscle') ?? ''} onChange={(e) => setParam('muscle', e.target.value)} style={input}>
        <option value="">All muscles</option>
        {MUSCLES.map((m) => (
          <option key={m} value={m}>{MUSCLE_LABEL[m]}</option>
        ))}
      </select>
      <select aria-label="Equipment" value={sp.get('equipment') ?? ''} onChange={(e) => setParam('equipment', e.target.value)} style={input}>
        <option value="">All equipment</option>
        {EQUIPMENT.map((e) => (
          <option key={e} value={e}>{e.charAt(0) + e.slice(1).toLowerCase().replace('_', ' ')}</option>
        ))}
      </select>
    </div>
  );
}

const input: React.CSSProperties = {
  height: 44,
  padding: '0 14px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 14.5,
  fontFamily: 'var(--font-sans)',
};
