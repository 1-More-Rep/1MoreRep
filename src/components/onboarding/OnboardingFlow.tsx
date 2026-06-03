'use client';

import { useState, useTransition } from 'react';
import type { UnitSystem } from '@prisma/client';
import { completeOnboardingAction } from '@/server/actions/onboarding';
import { Card, Btn, SectionLabel } from '@/components/ui';

const GOALS = ['Build muscle', 'Get stronger', 'Endurance', 'General health'];

export function OnboardingFlow() {
  const [goal, setGoal] = useState(0);
  const [units, setUnits] = useState<UnitSystem>('METRIC');
  const [pending, start] = useTransition();

  function finish() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    start(() => completeOnboardingAction({ timezone, unitSystem: units }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>What&apos;s your main goal?</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {GOALS.map((g, i) => (
            <button
              key={g}
              onClick={() => setGoal(i)}
              style={{
                padding: '16px 12px',
                borderRadius: 'var(--r)',
                border: `1.5px solid ${goal === i ? 'var(--accent)' : 'var(--line-2)'}`,
                background: goal === i ? 'var(--accent-soft)' : 'var(--surface)',
                color: goal === i ? 'var(--accent-text)' : 'var(--text)',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Units</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind={units === 'METRIC' ? 'primary' : 'soft'} size="sm" onClick={() => setUnits('METRIC')}>Metric (kg)</Btn>
          <Btn kind={units === 'IMPERIAL' ? 'primary' : 'soft'} size="sm" onClick={() => setUnits('IMPERIAL')}>Imperial (lb)</Btn>
        </div>
      </Card>

      <Btn size="lg" full icon="arrowR" disabled={pending} onClick={finish}>
        {pending ? 'Setting up…' : 'Generate my first workout'}
      </Btn>
    </div>
  );
}
