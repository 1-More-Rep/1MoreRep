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
  /** Resolved unit labels for the viewing user (kg/lb, cm/in). Values are already converted. */
  weightUnit: string;
  lengthUnit: string;
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

export function ProgressTabs({ volume, bodyweight, oneRm, measurements, weightUnit, lengthUnit }: ProgressTabsProps) {
  const [tab, setTab] = useState<TabId>('volume');

  // Roving-tabindex keyboard support (WAI-ARIA tabs): only the active tab is in the Tab
  // order, so arrow keys must move focus + selection between tabs, else the others are
  // keyboard-unreachable.
  function onTabKey(e: React.KeyboardEvent, idx: number) {
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    const id = TABS[next]!.id;
    setTab(id);
    document.getElementById(`progtab-${id}`)?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Progress metric"
        style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-2)', borderRadius: 'var(--r-pill)', marginBottom: 16 }}
      >
        {TABS.map((t, i) => {
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
              onKeyDown={(e) => onTabKey(e, i)}
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
        <LineChart points={volume} unit={`${weightUnit}·reps`} />
      </div>

      <div role="tabpanel" id="progpanel-1rm" aria-labelledby="progtab-1rm" hidden={tab !== '1rm'}>
        <SectionLabel style={{ marginBottom: 12 }}>Est. 1RM{oneRm.exerciseName ? ` — ${oneRm.exerciseName}` : ''}</SectionLabel>
        {oneRm.points.length > 0 ? <LineChart points={oneRm.points} unit={weightUnit} /> : <Empty>No estimated-1RM records yet — log some heavy sets.</Empty>}
      </div>

      <div role="tabpanel" id="progpanel-bodyweight" aria-labelledby="progtab-bodyweight" hidden={tab !== 'bodyweight'}>
        <SectionLabel style={{ marginBottom: 12 }}>Bodyweight</SectionLabel>
        {bodyweight.length > 0 ? <LineChart points={bodyweight} unit={weightUnit} /> : <Empty>No bodyweight logged yet.</Empty>}
      </div>

      <div role="tabpanel" id="progpanel-measurements" aria-labelledby="progtab-measurements" hidden={tab !== 'measurements'}>
        {measurements.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {measurements.map((m) => (
              <div key={m.key}>
                <SectionLabel style={{ marginBottom: 12 }}>{m.label}</SectionLabel>
                <LineChart points={m.points} unit={lengthUnit} />
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
