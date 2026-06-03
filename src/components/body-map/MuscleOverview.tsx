'use client';

import { useState, useTransition } from 'react';
import type { Muscle } from '@prisma/client';
import { MUSCLE_LABEL } from '@/domain/muscles/taxonomy';
import type { Landmark } from '@/domain/generator/landmarks';
import { reportSorenessAction } from '@/server/actions/fatigue';
import { BodyMap } from './BodyMap';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Mono, SectionLabel } from '@/components/ui/typography';

export interface MuscleInfo {
  fatigue: number;
  recoveryEtaHours: number;
  /** Trailing-7d fractional set volume (sets/week, by muscle weight). */
  weeklyVolume: number;
  /** MEV/MAV/MRV landmarks for this muscle. */
  landmarks: Landmark;
}

function etaLabel(hours: number): string {
  if (hours <= 0) return 'Fresh';
  if (hours < 1) return '<1h';
  if (hours < 48) return `~${Math.round(hours)}h`;
  return `~${Math.round(hours / 24)}d`;
}

function volumeZone(v: number, lm: Landmark): { label: string; color: string } {
  if (v < lm.mev) return { label: 'Below MEV', color: 'var(--text-3)' };
  if (v < lm.mav) return { label: 'Maintenance', color: 'var(--accent-text)' };
  if (v <= lm.mrv) return { label: 'Productive', color: 'var(--accent)' };
  return { label: 'Over MRV', color: '#c0392b' };
}

/** Labeled 7-day set-volume bar with MEV / MAV / MRV thresholds. */
function VolumeBar({ volume, landmarks }: { volume: number; landmarks: Landmark }) {
  const { mev, mav, mrv } = landmarks;
  // Scale to a bit past MRV so the bar always has headroom for the markers.
  const scaleMax = Math.max(mrv * 1.15, volume * 1.05, 1);
  const pct = (n: number) => `${Math.min(100, (n / scaleMax) * 100)}%`;
  const zone = volumeZone(volume, landmarks);
  const markers: { v: number; label: string }[] = [
    { v: mev, label: 'MEV' },
    { v: mav, label: 'MAV' },
    { v: mrv, label: 'MRV' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <SectionLabel>7-day volume</SectionLabel>
        <span style={{ fontSize: 12, fontWeight: 700, color: zone.color }}>{zone.label}</span>
      </div>
      <div style={{ position: 'relative', height: 14, background: 'var(--surface-2)', borderRadius: 99, border: '1px solid var(--line)' }}>
        <div style={{ position: 'absolute', inset: 0, width: pct(volume), background: zone.color, borderRadius: 99, opacity: 0.85, transition: 'width .2s' }} />
        {markers.map((m) => (
          <div key={m.label} aria-hidden="true" style={{ position: 'absolute', top: -2, bottom: -2, left: pct(m.v), width: 1.5, background: 'var(--text-2)', opacity: 0.55 }} />
        ))}
      </div>
      <div style={{ position: 'relative', height: 16, marginTop: 4 }}>
        {markers.map((m) => (
          <div key={m.label} style={{ position: 'absolute', left: pct(m.v), transform: 'translateX(-50%)', fontSize: 9.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
            {m.label} {m.v}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-3)' }}>
        <Mono style={{ color: 'var(--text-2)', fontWeight: 700 }}>{volume.toFixed(1)}</Mono> sets this week
      </div>
    </div>
  );
}

export function MuscleOverview({ data, topExercises }: { data: Record<Muscle, MuscleInfo>; topExercises: Record<string, { id: string; name: string }[]> }) {
  const [selected, setSelected] = useState<Muscle | null>(null);
  const [pending, start] = useTransition();
  const fatigueMap = Object.fromEntries(Object.entries(data).map(([m, v]) => [m, v.fatigue])) as Record<Muscle, number>;
  const etaMap = Object.fromEntries(Object.entries(data).map(([m, v]) => [m, v.recoveryEtaHours])) as Record<Muscle, number>;

  const info = selected ? data[selected] : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--gap)' }}>
      <Card>
        <BodyMap fatigue={fatigueMap} etaHours={etaMap} onSelect={setSelected} selected={selected} />
      </Card>

      {selected && info ? (
        <Card data-testid="muscle-detail">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <SectionLabel>Selected muscle</SectionLabel>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{MUSCLE_LABEL[selected]}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Mono style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-text)' }}>{Math.round(info.fatigue * 100)}%</Mono>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>fatigue · recovers {etaLabel(info.recoveryEtaHours)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <VolumeBar volume={info.weeklyVolume} landmarks={info.landmarks} />
          </div>

          <div style={{ marginTop: 16 }}>
            <SectionLabel style={{ marginBottom: 8 }}>How sore is it? (logs soreness)</SectionLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[0, 2, 4, 6, 8, 10].map((s) => (
                <Btn key={s} kind="soft" size="sm" disabled={pending} onClick={() => start(() => reportSorenessAction(selected, s))}>
                  {s === 0 ? 'None' : s}
                </Btn>
              ))}
            </div>
          </div>

          {topExercises[selected]?.length ? (
            <div style={{ marginTop: 16 }}>
              <SectionLabel style={{ marginBottom: 8 }}>Train it</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {topExercises[selected].slice(0, 4).map((ex) => (
                  <a key={ex.id} href={`/app/exercises/${ex.id}`} style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none' }}>
                    {ex.name}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card soft>
          <span style={{ color: 'var(--text-3)' }}>Tap a muscle to see fatigue, recovery time, and report soreness.</span>
        </Card>
      )}
    </div>
  );
}
