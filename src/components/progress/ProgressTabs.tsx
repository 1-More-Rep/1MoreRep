'use client';

import { useState } from 'react';
import { LineChart, type ChartPoint } from '@/components/charts/LineChart';
import { SectionLabel } from '@/components/ui/typography';

export interface MeasurementSeries {
  key: string;
  label: string;
  points: ChartPoint[];
}

export interface ProgressTabsProps {
  volume: ChartPoint[];
  bodyweight: ChartPoint[];
  oneRm: { exerciseName: string | null; points: ChartPoint[] };
  measurements: MeasurementSeries[];
}

const TABS = [
  { id: 'volume', label: 'Volume' },
  { id: '1rm', label: '1RM' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'measurements', label: 'Measurements' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--text-3)', fontSize: 14, padding: '20px 0' }}>{children}</div>;
}

export function ProgressTabs({ volume, bodyweight, oneRm, measurements }: ProgressTabsProps) {
  const [tab, setTab] = useState<TabId>('volume');

  return (
    <div>
      <div
        role="tablist"
        aria-label="Progress metric"
        style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-2)', borderRadius: 'var(--r-pill)', marginBottom: 16 }}
      >
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              id={`progtab-${t.id}`}
              aria-selected={selected}
              aria-controls={`progpanel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                border: 'none',
                cursor: 'pointer',
                padding: '8px 6px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                borderRadius: 'var(--r-pill)',
                background: selected ? 'var(--surface)' : 'transparent',
                color: selected ? 'var(--text)' : 'var(--text-3)',
                boxShadow: selected ? 'var(--shadow-sm)' : 'none',
                transition: 'background .15s, color .15s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="progpanel-volume" aria-labelledby="progtab-volume" hidden={tab !== 'volume'}>
        <SectionLabel style={{ marginBottom: 12 }}>Session volume</SectionLabel>
        <LineChart points={volume} unit="kg·reps" />
      </div>

      <div role="tabpanel" id="progpanel-1rm" aria-labelledby="progtab-1rm" hidden={tab !== '1rm'}>
        <SectionLabel style={{ marginBottom: 12 }}>Est. 1RM{oneRm.exerciseName ? ` — ${oneRm.exerciseName}` : ''}</SectionLabel>
        {oneRm.points.length > 0 ? <LineChart points={oneRm.points} unit="kg" /> : <Empty>No estimated-1RM records yet — log some heavy sets.</Empty>}
      </div>

      <div role="tabpanel" id="progpanel-bodyweight" aria-labelledby="progtab-bodyweight" hidden={tab !== 'bodyweight'}>
        <SectionLabel style={{ marginBottom: 12 }}>Bodyweight</SectionLabel>
        {bodyweight.length > 0 ? <LineChart points={bodyweight} unit="kg" /> : <Empty>No bodyweight logged yet.</Empty>}
      </div>

      <div role="tabpanel" id="progpanel-measurements" aria-labelledby="progtab-measurements" hidden={tab !== 'measurements'}>
        {measurements.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {measurements.map((m) => (
              <div key={m.key}>
                <SectionLabel style={{ marginBottom: 12 }}>{m.label}</SectionLabel>
                <LineChart points={m.points} unit="cm" />
              </div>
            ))}
          </div>
        ) : (
          <Empty>No body measurements logged yet.</Empty>
        )}
      </div>
    </div>
  );
}
