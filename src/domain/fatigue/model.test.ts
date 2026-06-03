import { describe, it, expect } from 'vitest';
import {
  setStimulus,
  sessionMuscleStimulus,
  decayFactor,
  recoveryEtaHours,
  computeFatigue,
  type SetInput,
} from './model';
import { HALF_LIFE_HOURS, MUSCLE_REF_STIMULUS } from '../muscles/taxonomy';

function workSet(over: Partial<SetInput> = {}): SetInput {
  return { weightKg: 100, reps: 8, rpe: 8, rir: null, isWarmup: false, completed: true, ...over };
}

describe('setStimulus', () => {
  it('is zero for warmups and incomplete sets', () => {
    expect(setStimulus(workSet({ isWarmup: true }))).toBe(0);
    expect(setStimulus(workSet({ completed: false }))).toBe(0);
    expect(setStimulus(workSet({ reps: 0 }))).toBe(0);
  });

  it('scales with intensity (RPE)', () => {
    expect(setStimulus(workSet({ rpe: 10 }))).toBeGreaterThan(setStimulus(workSet({ rpe: 6 })));
  });

  it('uses bodyweight when no external load', () => {
    expect(setStimulus(workSet({ weightKg: 0, bodyweightKg: 80 }))).toBeGreaterThan(0);
  });
});

describe('sessionMuscleStimulus', () => {
  it('distributes by exercise muscle weights', () => {
    const out = sessionMuscleStimulus([
      { muscleWeights: [{ muscle: 'CHEST', weight: 1.0 }, { muscle: 'TRICEPS', weight: 0.4 }], sets: [workSet()] },
    ]);
    expect(out.CHEST).toBeGreaterThan(0);
    expect(out.TRICEPS).toBeCloseTo(out.CHEST! * 0.4, 5);
  });
});

describe('decayFactor', () => {
  it('is 1 at age 0 and 0.5 at one half-life', () => {
    expect(decayFactor(0, 'CHEST')).toBe(1);
    expect(decayFactor(HALF_LIFE_HOURS.CHEST, 'CHEST')).toBeCloseTo(0.5, 6);
  });
});

describe('computeFatigue', () => {
  it('a fresh ref-stimulus session reads as full fatigue, halving after one half-life', () => {
    const ref = MUSCLE_REF_STIMULUS.CHEST;
    const now0 = computeFatigue([{ ageHours: 0, perMuscle: { CHEST: ref } }]);
    expect(now0.CHEST.fatigue).toBeCloseTo(1, 5);
    const halved = computeFatigue([{ ageHours: HALF_LIFE_HOURS.CHEST, perMuscle: { CHEST: ref } }]);
    expect(halved.CHEST.fatigue).toBeCloseTo(0.5, 5);
  });

  it('applies soreness boost that decays with a 24h half-life', () => {
    expect(computeFatigue([], [{ muscle: 'BICEPS', severity: 10, ageHours: 0 }]).BICEPS.fatigue).toBeCloseTo(0.6, 5);
    expect(computeFatigue([], [{ muscle: 'BICEPS', severity: 10, ageHours: 24 }]).BICEPS.fatigue).toBeCloseTo(0.3, 5);
  });

  it('clamps to [0,1] for an enormous stimulus', () => {
    const f = computeFatigue([{ ageHours: 0, perMuscle: { QUADS: 99999 } }]);
    expect(f.QUADS.fatigue).toBe(1);
  });

  it('warmup-only sessions leave muscles fresh', () => {
    const stim = sessionMuscleStimulus([{ muscleWeights: [{ muscle: 'CHEST', weight: 1 }], sets: [workSet({ isWarmup: true })] }]);
    expect(computeFatigue([{ ageHours: 0, perMuscle: stim }]).CHEST.fatigue).toBe(0);
  });
});

describe('recoveryEtaHours', () => {
  it('solves decay to the fresh threshold', () => {
    // fatigue 0.5, threshold 0.25 -> one half-life
    expect(recoveryEtaHours('CHEST', 0.5)).toBeCloseTo(HALF_LIFE_HOURS.CHEST, 5);
  });
  it('is zero when already fresh', () => {
    expect(recoveryEtaHours('CHEST', 0.2)).toBe(0);
  });
});
