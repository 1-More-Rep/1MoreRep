import { describe, it, expect } from 'vitest';
import { mapMuscle, mapEquipment, mapCategory, mapMechanic, mapForce } from '../../prisma/seed/muscleMap';
import { isMuscle } from '../../src/domain/muscles/taxonomy';

// Every muscle string the free-exercise-db dataset uses.
const SOURCE_MUSCLES = [
  'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms',
  'glutes', 'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'quadriceps',
  'shoulders', 'traps', 'triceps',
];

describe('dataset → taxonomy mapping', () => {
  it('maps every source muscle to a valid Muscle', () => {
    for (const s of SOURCE_MUSCLES) {
      const m = mapMuscle(s);
      expect(m, `unmapped: ${s}`).not.toBeNull();
      expect(isMuscle(m!)).toBe(true);
    }
  });

  it('maps equipment with an OTHER fallback', () => {
    expect(mapEquipment('barbell')).toBe('BARBELL');
    expect(mapEquipment('e-z curl bar')).toBe('EZ_BAR');
    expect(mapEquipment('body only')).toBe('BODYWEIGHT');
    expect(mapEquipment(null)).toBe('OTHER');
    expect(mapEquipment('unknown thing')).toBe('OTHER');
  });

  it('maps category, mechanic, force', () => {
    expect(mapCategory('olympic weightlifting')).toBe('OLYMPIC');
    expect(mapMechanic('compound')).toBe('COMPOUND');
    expect(mapMechanic(null)).toBeNull();
    expect(mapForce('push')).toBe('PUSH');
  });
});
