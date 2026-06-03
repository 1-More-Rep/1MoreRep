import { describe, it, expect } from 'vitest';
import { findCuratedOverride } from './muscleWeights';

describe('curated muscle weights', () => {
  it('maps the bench press to chest-dominant weights', () => {
    const o = findCuratedOverride('Barbell Bench Press');
    expect(o?.weights.CHEST).toBe(1.0);
    expect(o?.weights.TRICEPS).toBe(0.4);
    expect(o?.weights.FRONT_DELTS).toBe(0.5);
  });

  it('distinguishes incline from flat bench', () => {
    expect(findCuratedOverride('Incline Dumbbell Press')?.weights.CHEST).toBe(0.9);
    expect(findCuratedOverride('Barbell Bench Press')?.weights.CHEST).toBe(1.0);
  });

  it('routes deadlift variants correctly (specific before general)', () => {
    expect(findCuratedOverride('Romanian Deadlift')?.weights.HAMSTRINGS).toBe(1.0);
    expect(findCuratedOverride('Conventional Deadlift')?.weights.LOWER_BACK).toBe(0.9);
  });

  it('lateral raise targets side delts', () => {
    const o = findCuratedOverride('Dumbbell Lateral Raise');
    expect(o?.weights.SIDE_DELTS).toBe(1.0);
  });

  it('returns null for unmatched names', () => {
    expect(findCuratedOverride('Some Obscure Machine Thing')).toBeNull();
  });
});
