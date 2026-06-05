/**
 * Pick the locale-appropriate exercise name / instructions. Exercises carry a
 * German overlay (nameDe / instructionsDe, seeded from the translation); for a
 * German viewer we show that, falling back to the original English when an
 * overlay is missing (e.g. a user's custom exercise).
 */
export function exName(ex: { name: string; nameDe?: string | null }, locale: string): string {
  return locale === 'de' && ex.nameDe ? ex.nameDe : ex.name;
}

export function exInstructions(
  ex: { instructions: string[]; instructionsDe?: string[] | null },
  locale: string,
): string[] {
  return locale === 'de' && ex.instructionsDe && ex.instructionsDe.length ? ex.instructionsDe : ex.instructions;
}
