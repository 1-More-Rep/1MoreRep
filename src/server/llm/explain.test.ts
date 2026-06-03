import { describe, it, expect } from 'vitest';
import { explainPlan, deterministicExplanation } from './explain';
import type { LLMProvider } from './provider';
import type { GeneratorPlan } from '@/domain/generator/types';

const plan: GeneratorPlan = {
  exercises: [
    { exerciseId: 'squat', name: 'Back Squat', primaryMuscle: 'QUADS', sets: 3, repLow: 8, repHigh: 12, restSec: 120, rpeTarget: 8, loadSuggestionKg: 100 },
  ],
  rationale: ['Back Squat — Quads (priority 0.80)'],
};

function provider(over: Partial<LLMProvider>): LLMProvider {
  return {
    kind: 'TEST',
    isConfigured: () => true,
    health: async () => true,
    complete: async () => ({ text: 'LLM says hi.' }),
    ...over,
  };
}

const baseline = deterministicExplanation(plan);

describe('explainPlan fallback', () => {
  it('falls back when unconfigured', async () => {
    expect(await explainPlan(plan, provider({ isConfigured: () => false }))).toBe(baseline);
  });
  it('falls back when unhealthy', async () => {
    expect(await explainPlan(plan, provider({ health: async () => false }))).toBe(baseline);
  });
  it('falls back when complete throws (timeout/error)', async () => {
    expect(await explainPlan(plan, provider({ complete: async () => { throw new Error('timeout'); } }))).toBe(baseline);
  });
  it('falls back on empty output', async () => {
    expect(await explainPlan(plan, provider({ complete: async () => ({ text: '   ' }) }))).toBe(baseline);
  });
  it('uses the LLM output when healthy and non-empty', async () => {
    expect(await explainPlan(plan, provider({}))).toBe('LLM says hi.');
  });
  it('deterministic baseline mentions the session shape', () => {
    expect(baseline).toMatch(/1-exercise session/);
  });
});
