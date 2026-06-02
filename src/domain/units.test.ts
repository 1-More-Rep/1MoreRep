import { describe, it, expect } from 'vitest';
import { kgToLb, lbToKg, roundTo, clamp01, KG_PER_LB } from './units';

describe('units', () => {
  it('converts kg <-> lb round-trip', () => {
    expect(lbToKg(100)).toBeCloseTo(45.359237, 5);
    expect(kgToLb(lbToKg(135))).toBeCloseTo(135, 6);
    expect(KG_PER_LB).toBeCloseTo(0.45359237, 8);
  });

  it('rounds to plate increments', () => {
    expect(roundTo(63.7, 2.5)).toBe(62.5); // nearest 2.5 (1.2 below vs 1.3 above)
    expect(roundTo(64, 2.5)).toBe(65);
    expect(roundTo(61, 2.5)).toBe(60);
    expect(roundTo(42, 0)).toBe(42); // step<=0 is a no-op
  });

  it('clamps to [0,1]', () => {
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(1.7)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(NaN)).toBe(0);
  });
});
