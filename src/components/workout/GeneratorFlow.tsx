'use client';

import { useState, useTransition } from 'react';
import type { Equipment } from '@prisma/client';
import { generatePlanAction, startFromPlanAction, type GenerateResult } from '@/server/actions/generator';
import type { GenGoal } from '@/domain/generator/types';
import { MUSCLE_LABEL } from '@/domain/muscles/taxonomy';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { Mono, SectionLabel } from '@/components/ui/typography';

const GOALS: { value: GenGoal; label: string }[] = [
  { value: 'HYPERTROPHY', label: 'Hypertrophy' },
  { value: 'STRENGTH', label: 'Strength' },
  { value: 'ENDURANCE', label: 'Endurance' },
  { value: 'GENERAL', label: 'General' },
];
const TIMES = [30, 45, 60, 90];
const EQUIP: Equipment[] = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND'];

export function GeneratorFlow() {
  const [goal, setGoal] = useState<GenGoal>('HYPERTROPHY');
  const [time, setTime] = useState(60);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggleEquip(e: Equipment) {
    setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  function generate() {
    setError(null);
    start(async () => {
      try {
        const r = await generatePlanAction({ goal, availableTimeMin: time, equipment });
        if (r.plan.exercises.length === 0) setError('No exercises matched. Try different equipment or more time.');
        setResult(r);
      } catch {
        setError('Could not generate a workout. Try again.');
      }
    });
  }

  if (result && result.plan.exercises.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <Card style={{ borderColor: 'var(--accent-line)' }}>
          <SectionLabel style={{ marginBottom: 8 }}>Why this workout</SectionLabel>
          <p data-testid="gen-explanation" style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--text-2)', margin: 0 }}>{result.explanation}</p>
        </Card>

        <Card pad={false}>
          {result.plan.exercises.map((ex, i) => (
            <div key={ex.exerciseId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--row) var(--pad)', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <Mono style={{ color: 'var(--text-3)', width: 18 }}>{i + 1}</Mono>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{ex.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{MUSCLE_LABEL[ex.primaryMuscle]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Mono style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{ex.sets} × {ex.repLow}–{ex.repHigh}</Mono>
                {ex.loadSuggestionKg != null && <Mono style={{ fontSize: 11.5, color: 'var(--text-3)' }}>~{ex.loadSuggestionKg} kg</Mono>}
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: 'flex', gap: 10 }}>
          <form action={startFromPlanAction.bind(null, result.plan, goal)} style={{ flex: 1 }}>
            <Btn type="submit" full size="lg" icon="play">Start this workout</Btn>
          </form>
          <Btn kind="soft" size="lg" icon="repeat" disabled={pending} onClick={generate}>Regenerate</Btn>
        </div>
        <Btn kind="ghost" size="sm" onClick={() => setResult(null)} style={{ alignSelf: 'center' }}>Change inputs</Btn>
      </div>
    );
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && <Chip style={{ color: '#c0392b' }}>{error}</Chip>}
      <div>
        <SectionLabel style={{ marginBottom: 10 }}>Goal</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GOALS.map((g) => (
            <Btn key={g.value} kind={goal === g.value ? 'primary' : 'soft'} size="sm" onClick={() => setGoal(g.value)}>{g.label}</Btn>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel style={{ marginBottom: 10 }}>Time available</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIMES.map((t) => (
            <Btn key={t} kind={time === t ? 'primary' : 'soft'} size="sm" onClick={() => setTime(t)}>{t} min</Btn>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel style={{ marginBottom: 10 }}>Equipment (none = all)</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EQUIP.map((e) => (
            <Btn key={e} kind={equipment.includes(e) ? 'primary' : 'soft'} size="sm" onClick={() => toggleEquip(e)}>
              {e.charAt(0) + e.slice(1).toLowerCase()}
            </Btn>
          ))}
        </div>
      </div>
      <Btn size="lg" icon="bolt" disabled={pending} onClick={generate}>{pending ? 'Generating…' : 'Generate workout'}</Btn>
    </Card>
  );
}
