'use client';

import { useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { Equipment } from '@prisma/client';
import {
  generatePlanAction,
  startFromPlanAction,
  swapExerciseAction,
  adjustDifficultyAction,
  parseGoalAction,
  type GenerateResult,
  type GenInputs,
} from '@/server/actions/generator';
import type { GenGoal } from '@/domain/generator/types';
import { MUSCLE_LABEL } from '@/domain/muscles/taxonomy';
import { formatWeight, weightUnit, type UnitSystemLike } from '@/domain/units';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Mono, SectionLabel } from '@/components/ui/typography';

const GOALS: GenGoal[] = ['HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'GENERAL'];
const TIMES = [30, 45, 60, 90];
const EQUIP: Equipment[] = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND'];

export function GeneratorFlow({ initialGoal, unitSystem }: { initialGoal?: GenGoal; unitSystem: UnitSystemLike }) {
  const t = useTranslations('workout');
  const [goal, setGoal] = useState<GenGoal>(initialGoal ?? 'HYPERTROPHY');
  const [time, setTime] = useState(60);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [freeText, setFreeText] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const inputs = (): GenInputs => ({ goal, availableTimeMin: time, equipment });

  function toggleEquip(e: Equipment) {
    setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  function applyFreeText() {
    if (!freeText.trim()) return;
    start(async () => {
      const parsed = await parseGoalAction(freeText);
      setGoal(parsed.goal);
      setTime(parsed.availableTimeMin <= 45 ? (parsed.availableTimeMin <= 30 ? 30 : 45) : parsed.availableTimeMin >= 90 ? 90 : 60);
      setEquipment(parsed.equipment);
    });
  }

  function generate() {
    setError(null);
    start(async () => {
      try {
        const r = await generatePlanAction(inputs());
        if (r.plan.exercises.length === 0) setError(t('genNoMatch'));
        setResult(r);
      } catch {
        setError(t('genFailed'));
      }
    });
  }

  function swap(index: number) {
    if (!result) return;
    setError(null);
    start(async () => {
      try {
        const r = await swapExerciseAction(inputs(), result.plan, index);
        setResult(r);
      } catch {
        setError(t('swapFailed'));
      }
    });
  }

  function adjust(direction: 'harder' | 'easier') {
    if (!result) return;
    setError(null);
    start(async () => {
      try {
        const r = await adjustDifficultyAction(result.plan, direction);
        setResult(r);
      } catch {
        setError(t('adjustFailed'));
      }
    });
  }

  if (result && result.plan.exercises.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        {/* Swap/adjust failures land here instead of throwing up to the error boundary. */}
        {error && <div role="alert"><Chip style={{ color: '#c0392b' }}>{error}</Chip></div>}
        <Card style={{ borderColor: 'var(--accent-line)' }}>
          <SectionLabel style={{ marginBottom: 8 }}>{t('whyThisWorkout')}</SectionLabel>
          <p data-testid="gen-explanation" style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--text-2)', margin: 0 }}>{result.explanation}</p>
        </Card>

        <Card pad={false}>
          {result.plan.exercises.map((ex, i) => (
            <div key={`${ex.exerciseId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--row) var(--pad)', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <Mono style={{ color: 'var(--text-3)', width: 18 }}>{i + 1}</Mono>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{ex.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  {MUSCLE_LABEL[ex.primaryMuscle]}{ex.supersetGroup != null ? ` · ${t('supersetSuffix')}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Mono style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{ex.sets} × {ex.repLow}–{ex.repHigh}</Mono>
                {ex.loadSuggestionKg != null && <Mono style={{ fontSize: 11.5, color: 'var(--text-3)' }}>~{formatWeight(ex.loadSuggestionKg, unitSystem)} {weightUnit(unitSystem)}</Mono>}
              </div>
              <button onClick={() => swap(i)} disabled={pending} aria-label={t('swapExercise', { name: ex.name })} title={t('swapExerciseTitle')} style={{ background: 'none', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', height: 34, width: 34, color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="repeat" size={15} />
              </button>
            </div>
          ))}
        </Card>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SectionLabel>{t('difficulty')}</SectionLabel>
          <Btn kind="soft" size="sm" disabled={pending} onClick={() => adjust('easier')}>{t('easier')}</Btn>
          <Btn kind="soft" size="sm" disabled={pending} onClick={() => adjust('harder')}>{t('harder')}</Btn>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <form action={startFromPlanAction.bind(null, result.plan, goal)} style={{ flex: 1 }}>
            <StartWorkoutSubmit />
          </form>
          <Btn kind="soft" size="lg" icon="repeat" disabled={pending} onClick={generate}>{t('regenerate')}</Btn>
        </div>
        <Btn kind="ghost" size="sm" onClick={() => setResult(null)} style={{ alignSelf: 'center' }}>{t('changeInputs')}</Btn>
      </div>
    );
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && <div role="alert"><Chip style={{ color: '#c0392b' }}>{error}</Chip></div>}

      <div>
        <SectionLabel style={{ marginBottom: 10 }}>{t('describeOptional')}</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFreeText(); } }}
            placeholder={t('describePlaceholder')}
            aria-label={t('describeAria')}
            style={{ flex: 1, height: 42, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-sans)' }}
          />
          <Btn kind="soft" size="sm" disabled={pending || !freeText.trim()} onClick={applyFreeText}>{t('fill')}</Btn>
        </div>
      </div>

      <div>
        <SectionLabel style={{ marginBottom: 10 }}>{t('goal')}</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GOALS.map((g) => (
            <Btn key={g} kind={goal === g ? 'primary' : 'soft'} size="sm" onClick={() => setGoal(g)}>{t(`goal_${g}`)}</Btn>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel style={{ marginBottom: 10 }}>{t('timeAvailable')}</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIMES.map((tm) => (
            <Btn key={tm} kind={time === tm ? 'primary' : 'soft'} size="sm" onClick={() => setTime(tm)}>{t('minutes', { min: tm })}</Btn>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel style={{ marginBottom: 10 }}>{t('equipmentNoneAll')}</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EQUIP.map((e) => (
            <Btn key={e} kind={equipment.includes(e) ? 'primary' : 'soft'} size="sm" onClick={() => toggleEquip(e)}>
              {t(`equip_${e}`)}
            </Btn>
          ))}
        </div>
      </div>
      <Btn size="lg" icon="bolt" disabled={pending} onClick={generate}>{pending ? t('generating') : t('generateWorkout')}</Btn>
    </Card>
  );
}

/**
 * Pending-aware submit for the "Start this workout" form. useFormStatus disables the
 * button while the server action is in flight so a double-tap can't start two sessions.
 */
function StartWorkoutSubmit() {
  const t = useTranslations('workout');
  const { pending } = useFormStatus();
  return (
    <Btn type="submit" full size="lg" icon="play" disabled={pending}>
      {pending ? t('starting') : t('startThisWorkout')}
    </Btn>
  );
}
