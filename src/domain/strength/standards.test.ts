import { describe, it, expect } from 'vitest';
import { bandsForSex, classifyStrength, MUSCLE_STANDARD, STRENGTH_TIERS } from './standards';

describe('classifyStrength', () => {
  it('places a beginner bench below the first band', () => {
    // Male CHEST bands start at 0.5× bodyweight.
    const c = classifyStrength(0.3, 'CHEST', 'MALE');
    expect(c?.tier).toBe('Beginner');
    expect(c?.tierIndex).toBe(0);
    expect(c?.nextThreshold).toBe(0.5);
  });

  it('places a 2x bodyweight bench at the top tier (Olympian)', () => {
    const c = classifyStrength(2.0, 'CHEST', 'MALE');
    expect(c?.tier).toBe('Olympian');
    expect(c?.tierIndex).toBe(STRENGTH_TIERS.length - 1);
    expect(c?.nextThreshold).toBeNull();
  });

  it('returns null for muscles without a standard', () => {
    expect(classifyStrength(1.0, 'ABS', 'MALE')).toBeNull();
    expect(MUSCLE_STANDARD.ABS).toBeUndefined();
  });

  it('female bands are lower than male, so the same lift ranks higher', () => {
    const male = classifyStrength(1.1, 'CHEST', 'MALE')!;
    const female = classifyStrength(1.1, 'CHEST', 'FEMALE')!;
    expect(female.tierIndex).toBeGreaterThanOrEqual(male.tierIndex);
  });

  it('unspecified sex uses the midpoint between male and female bands', () => {
    const std = MUSCLE_STANDARD.CHEST!;
    const uni = bandsForSex(std, 'UNSPECIFIED');
    const expectedFirst = +(std.maleBands[0] * ((1 + std.femaleFactor) / 2)).toFixed(3);
    expect(uni[0]).toBe(expectedFirst);
  });
});
