import { describe, it, expect } from 'vitest';
import { parseGoal, regexParse } from './parseGoal';
import type { LLMProvider } from './provider';

function stub(over: Partial<LLMProvider>): LLMProvider {
  return { kind: 'STUB', isConfigured: () => true, health: async () => true, complete: async () => ({ text: '{}' }), ...over };
}

describe('parseGoal (regex baseline)', () => {
  it('extracts goal, time, and equipment from free text', () => {
    const r = regexParse('45 min dumbbell hypertrophy session');
    expect(r.goal).toBe('HYPERTROPHY');
    expect(r.availableTimeMin).toBe(45);
    expect(r.equipment).toContain('DUMBBELL');
  });

  it('reads hours and strength intent', () => {
    const r = regexParse('1 hour barbell strength work');
    expect(r.goal).toBe('STRENGTH');
    expect(r.availableTimeMin).toBe(60);
    expect(r.equipment).toContain('BARBELL');
  });

  it('defaults to 60 min hypertrophy when unspecified', () => {
    const r = regexParse('just a workout');
    expect(r.availableTimeMin).toBe(60);
    expect(r.goal).toBe('HYPERTROPHY');
    expect(r.equipment).toEqual([]);
  });
});

describe('parseGoal (LLM with fallback)', () => {
  it('falls back to the regex baseline on unconfigured / unhealthy / malformed', async () => {
    const text = '30 min kettlebell endurance';
    const base = regexParse(text);
    expect(await parseGoal(text, stub({ isConfigured: () => false }))).toEqual(base);
    expect(await parseGoal(text, stub({ health: async () => false }))).toEqual(base);
    expect(await parseGoal(text, stub({ complete: async () => ({ text: '{bad json' }) }))).toEqual(base);
    // schema-invalid LLM output also falls back
    const invalid = await parseGoal(text, stub({ complete: async () => ({ text: JSON.stringify({ goal: 'BOGUS', availableTimeMin: 5, equipment: [] }) }) }));
    expect(invalid).toEqual(base);
  });

  it('accepts and revalidates a well-formed LLM response', async () => {
    const out = await parseGoal('whatever', stub({ complete: async () => ({ text: JSON.stringify({ goal: 'STRENGTH', availableTimeMin: 75, equipment: ['BARBELL', 'BARBELL'] }) }) }));
    expect(out.goal).toBe('STRENGTH');
    expect(out.availableTimeMin).toBe(75);
    expect(out.equipment).toEqual(['BARBELL']); // de-duped
  });
});
