'use client';

import { useState, useTransition } from 'react';
import type { Muscle } from '@prisma/client';
import { MUSCLE_LABEL } from '@/domain/muscles/taxonomy';
import { reportSorenessAction } from '@/server/actions/fatigue';
import { BodyMap } from './BodyMap';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Mono, SectionLabel } from '@/components/ui/typography';

export interface MuscleInfo {
  fatigue: number;
  recoveryEtaHours: number;
}

function etaLabel(hours: number): string {
  if (hours <= 0) return 'Fresh';
  if (hours < 1) return '<1h';
  if (hours < 48) return `~${Math.round(hours)}h`;
  return `~${Math.round(hours / 24)}d`;
}

export function MuscleOverview({ data, topExercises }: { data: Record<Muscle, MuscleInfo>; topExercises: Record<string, { id: string; name: string }[]> }) {
  const [selected, setSelected] = useState<Muscle | null>(null);
  const [pending, start] = useTransition();
  const fatigueMap = Object.fromEntries(Object.entries(data).map(([m, v]) => [m, v.fatigue])) as Record<Muscle, number>;

  const info = selected ? data[selected] : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--gap)' }}>
      <Card>
        <BodyMap fatigue={fatigueMap} onSelect={setSelected} selected={selected} />
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
