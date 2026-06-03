import { describe, it, expect } from 'vitest';
import { epley, brzycki, est1RM, weightForReps } from './oneRepMax';

describe('one-rep-max', () => {
  it('matches known Epley/Brzycki values', () => {
    expect(epley(100, 5)).toBeCloseTo(116.67, 1);
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 1);
  });

  it('est1RM averages and is bounded below by the working weight', () => {
    const e = est1RM(100, 5);
    expect(e).toBeGreaterThan(100);
    expect(e).toBeCloseTo((116.67 + 112.5) / 2, 0);
  });

  it('handles edge reps', () => {
    expect(est1RM(80, 1)).toBe(80);
    expect(est1RM(80, 0)).toBe(0);
    expect(est1RM(0, 5)).toBe(0);
  });

  it('is monotonic in weight and reps', () => {
    expect(est1RM(100, 5)).toBeGreaterThan(est1RM(90, 5));
    expect(est1RM(100, 6)).toBeGreaterThan(est1RM(100, 5));
  });

  it('weightForReps inverts toward a rep target', () => {
    const oneRm = est1RM(100, 1); // 100
    expect(weightForReps(oneRm, 1)).toBe(100);
    expect(weightForReps(120, 10)).toBeCloseTo(120 / (1 + 10 / 30), 4);
  });
});
