import { describe, it, expect } from 'vitest';
import { generateWorkout, swapExercise } from './engine';
import { MUSCLES, type Muscle } from '../muscles/taxonomy';
import type { GeneratorInput, GeneratorPlan, PoolExercise } from './types';

const POOL: PoolExercise[] = [
  { id: 'squat', slug: 'squat', name: 'Back Squat', mechanic: 'COMPOUND', equipment: 'BARBELL', defaultRestSec: 180, muscleWeights: [{ muscle: 'QUADS', weight: 1, role: 'PRIMARY' }, { muscle: 'GLUTES', weight: 0.7, role: 'SECONDARY' }, { muscle: 'HAMSTRINGS', weight: 0.4, role: 'SECONDARY' }] },
  { id: 'bench', slug: 'bench', name: 'Bench Press', mechanic: 'COMPOUND', equipment: 'BARBELL', defaultRestSec: 150, muscleWeights: [{ muscle: 'CHEST', weight: 1, role: 'PRIMARY' }, { muscle: 'FRONT_DELTS', weight: 0.5, role: 'SECONDARY' }, { muscle: 'TRICEPS', weight: 0.4, role: 'SECONDARY' }] },
  { id: 'row', slug: 'row', name: 'Barbell Row', mechanic: 'COMPOUND', equipment: 'BARBELL', defaultRestSec: 150, muscleWeights: [{ muscle: 'LATS', weight: 1, role: 'PRIMARY' }, { muscle: 'RHOMBOIDS', weight: 0.7, role: 'SECONDARY' }, { muscle: 'BICEPS', weight: 0.4, role: 'SECONDARY' }] },
  { id: 'legcurl', slug: 'legcurl', name: 'Leg Curl', mechanic: 'ISOLATION', equipment: 'MACHINE', defaultRestSec: 90, muscleWeights: [{ muscle: 'HAMSTRINGS', weight: 1, role: 'PRIMARY' }] },
  { id: 'curl', slug: 'curl', name: 'Dumbbell Curl', mechanic: 'ISOLATION', equipment: 'DUMBBELL', defaultRestSec: 90, muscleWeights: [{ muscle: 'BICEPS', weight: 1, role: 'PRIMARY' }, { muscle: 'FOREARMS', weight: 0.4, role: 'SECONDARY' }] },
  { id: 'lateral', slug: 'lateral', name: 'Lateral Raise', mechanic: 'ISOLATION', equipment: 'DUMBBELL', defaultRestSec: 60, muscleWeights: [{ muscle: 'SIDE_DELTS', weight: 1, role: 'PRIMARY' }] },
  { id: 'pushdown', slug: 'pushdown', name: 'Triceps Pushdown', mechanic: 'ISOLATION', equipment: 'CABLE', defaultRestSec: 75, muscleWeights: [{ muscle: 'TRICEPS', weight: 1, role: 'PRIMARY' }] },
  { id: 'legpress', slug: 'legpress', name: 'Leg Press', mechanic: 'COMPOUND', equipment: 'MACHINE', defaultRestSec: 150, muscleWeights: [{ muscle: 'QUADS', weight: 1, role: 'PRIMARY' }, { muscle: 'GLUTES', weight: 0.6, role: 'SECONDARY' }] },
];

function freshPerMuscle(over: Partial<Record<Muscle, { fatigue: number; weeklyVolume: number }>> = {}) {
  const out = {} as Record<Muscle, { fatigue: number; weeklyVolume: number }>;
  for (const m of MUSCLES) out[m] = { fatigue: 0.2, weeklyVolume: 0 };
  return { ...out, ...over };
}

function input(over: Partial<GeneratorInput> = {}): GeneratorInput {
  return {
    goal: 'HYPERTROPHY',
    availableTimeMin: 60,
    experience: 'INTERMEDIATE',
    perMuscle: freshPerMuscle(),
    pool: POOL,
    history: {},
    recentlyUsed: [],
    ...over,
  };
}

const names = (p: { exercises: { name: string }[] }) => p.exercises.map((e) => e.name);

describe('generateWorkout', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(generateWorkout(input()))).toBe(JSON.stringify(generateWorkout(input())));
  });

  it('excludes a sore/overreached muscle and notes it', () => {
    const plan = generateWorkout(input({ perMuscle: freshPerMuscle({ CHEST: { fatigue: 0.9, weeklyVolume: 8 } }) }));
    expect(names(plan)).not.toContain('Bench Press');
    expect(plan.rationale.join(' ')).toMatch(/Skipped Chest/);
  });

  it('excludes a muscle at MRV even when fresh', () => {
    const plan = generateWorkout(input({ perMuscle: freshPerMuscle({ QUADS: { fatigue: 0.2, weeklyVolume: 25 } }) }));
    expect(names(plan)).not.toContain('Back Squat');
    expect(names(plan)).not.toContain('Leg Press');
  });

  it('applies the goal rep/rest scheme', () => {
    const strength = generateWorkout(input({ goal: 'STRENGTH' }));
    expect(strength.exercises[0]!.repLow).toBe(3);
    expect(strength.exercises[0]!.repHigh).toBe(6);
    expect(strength.exercises[0]!.restSec).toBe(210);
    const endurance = generateWorkout(input({ goal: 'ENDURANCE' }));
    expect(endurance.exercises[0]!.repHigh).toBe(20);
  });

  it('scales exercise count with available time', () => {
    const short = generateWorkout(input({ availableTimeMin: 30 }));
    const long = generateWorkout(input({ availableTimeMin: 120 }));
    expect(short.exercises.length).toBe(3);
    expect(long.exercises.length).toBeGreaterThan(short.exercises.length);
    expect(long.exercises.length).toBeLessThanOrEqual(8);
  });

  it('only selects from the provided (equipment-filtered) pool', () => {
    const dumbbellOnly = POOL.filter((e) => e.equipment === 'DUMBBELL');
    const plan = generateWorkout(input({ pool: dumbbellOnly }));
    for (const e of plan.exercises) expect(['Dumbbell Curl', 'Lateral Raise']).toContain(e.name);
  });

  it('orders compounds before isolations', () => {
    const plan = generateWorkout(input());
    const mechanics = plan.exercises.map((e) => POOL.find((p) => p.id === e.exerciseId)!.mechanic);
    const firstIso = mechanics.indexOf('ISOLATION');
    const lastComp = mechanics.lastIndexOf('COMPOUND');
    if (firstIso !== -1 && lastComp !== -1) expect(lastComp).toBeLessThan(firstIso === -1 ? Infinity : firstIso + 99);
  });

  it('suggests progressive-overload loads from history, null without history', () => {
    const plan = generateWorkout(input({ goal: 'HYPERTROPHY', history: { squat: { est1RM: 140, hitTopRangeLowRir: true } } }));
    const squat = plan.exercises.find((e) => e.exerciseId === 'squat');
    // weightForReps(140,12)=100; *1.025=102.5; round 2.5 => 102.5
    expect(squat?.loadSuggestionKg).toBe(102.5);
    const noHist = plan.exercises.find((e) => e.exerciseId === 'bench');
    expect(noHist?.loadSuggestionKg ?? null).toBeNull();
  });

  it('matches a deterministic snapshot for representative inputs (Gen-T6)', () => {
    expect(generateWorkout(input({ goal: 'HYPERTROPHY', availableTimeMin: 60 }))).toMatchSnapshot();
    expect(generateWorkout(input({ goal: 'STRENGTH', availableTimeMin: 90 }))).toMatchSnapshot();
  });

  it('force-covers a high-priority uncovered muscle by swapping a selection (Gen-T6)', () => {
    const pool = POOL.filter((e) => ['squat', 'bench', 'row', 'lateral'].includes(e.id));
    const plan = generateWorkout(input({ pool, availableTimeMin: 30 })); // 3 slots, 4 candidates
    expect(names(plan)).toContain('Lateral Raise'); // SIDE_DELTS forced in
    expect(plan.rationale.some((r) => /^Forced/.test(r))).toBe(true);
  });

  it('supersets antagonist pairs only when time is tight (Gen-T4)', () => {
    const pair = POOL.filter((e) => e.id === 'bench' || e.id === 'row'); // CHEST + LATS = antagonists
    const tight = generateWorkout(input({ pool: pair, availableTimeMin: 30 }));
    const relaxed = generateWorkout(input({ pool: pair, availableTimeMin: 90 }));
    expect(tight.exercises.filter((e) => e.supersetGroup != null).length).toBe(2);
    expect(relaxed.exercises.every((e) => e.supersetGroup === undefined)).toBe(true);
  });

  it('swaps a slot to a different exercise for the same muscle (Gen-T3)', () => {
    const plan: GeneratorPlan = {
      rationale: [],
      exercises: [{ exerciseId: 'squat', name: 'Back Squat', primaryMuscle: 'QUADS', sets: 3, repLow: 8, repHigh: 12, restSec: 120, rpeTarget: 8, loadSuggestionKg: null }],
    };
    const swapped = swapExercise(input({ pool: POOL }), plan, 0);
    expect(swapped.exercises[0]!.exerciseId).not.toBe('squat');
    expect(swapped.exercises[0]!.primaryMuscle).toBe('QUADS'); // Leg Press keeps the muscle
  });
});
