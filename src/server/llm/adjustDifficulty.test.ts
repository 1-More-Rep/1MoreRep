import { describe, it, expect } from 'vitest';
import { adjustDifficulty, deterministicAdjust } from './adjustDifficulty';
import type { LLMProvider } from './provider';
import type { GeneratorPlan } from '@/domain/generator/types';

const plan: GeneratorPlan = {
  rationale: [],
  exercises: [
    { exerciseId: 'bench', name: 'Bench', primaryMuscle: 'CHEST', sets: 3, repLow: 8, repHigh: 12, restSec: 120, rpeTarget: 8, loadSuggestionKg: 100 },
  ],
};

function stub(over: Partial<LLMProvider>): LLMProvider {
  return {
    kind: 'STUB',
    isConfigured: () => true,
    health: async () => true,
    complete: async () => ({ text: '{}' }),
    ...over,
  };
}

describe('adjustDifficulty', () => {
  it('deterministic baseline bumps sets/load/rpe up when harder', () => {
    const r = deterministicAdjust(plan, 'harder');
    expect(r.exercises[0]!.sets).toBe(4);
    expect(r.exercises[0]!.loadSuggestionKg).toBe(105); // 100 * 1.05
    expect(r.exercises[0]!.rpeTarget).toBe(8.5);
  });

  it('falls back to deterministic on unconfigured / unhealthy / parse-fail', async () => {
    const baseline = deterministicAdjust(plan, 'easier');
    const unconfigured = await adjustDifficulty(plan, 'easier', stub({ isConfigured: () => false }));
    expect(unconfigured.exercises[0]!.loadSuggestionKg).toBe(baseline.exercises[0]!.loadSuggestionKg);
    const unhealthy = await adjustDifficulty(plan, 'easier', stub({ health: async () => false }));
    expect(unhealthy.exercises[0]!.sets).toBe(baseline.exercises[0]!.sets);
    const garbage = await adjustDifficulty(plan, 'easier', stub({ complete: async () => ({ text: 'not json' }) }));
    expect(garbage.exercises[0]!.sets).toBe(baseline.exercises[0]!.sets);
  });

  it('rejects out-of-catalog exercise ids (falls back to baseline)', async () => {
    const baseline = deterministicAdjust(plan, 'harder');
    const out = await adjustDifficulty(
      plan,
      'harder',
      stub({ complete: async () => ({ text: JSON.stringify({ adjustments: [{ exerciseId: 'ghost', sets: 99 }] }) }) }),
    );
    // the bogus id was never matched → applied=0 → deterministic baseline
    expect(out.exercises[0]!.sets).toBe(baseline.exercises[0]!.sets);
    expect(out.exercises[0]!.exerciseId).toBe('bench');
  });

  it('clamps absurd loads to ±50% of the original', async () => {
    const out = await adjustDifficulty(
      plan,
      'harder',
      stub({ complete: async () => ({ text: JSON.stringify({ adjustments: [{ exerciseId: 'bench', loadSuggestionKg: 99999 }] }) }) }),
    );
    expect(out.exercises[0]!.loadSuggestionKg).toBe(150); // clamped to 100 * 1.5
  });
});
