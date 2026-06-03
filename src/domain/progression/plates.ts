// Barbell plate calculator. Pure.

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Plates to load PER SIDE to reach `target` kg on a `bar`-kg barbell. */
export function platesPerSide(target: number, bar = 20, plates: number[] = DEFAULT_PLATES): number[] {
  let perSide = (target - bar) / 2;
  if (perSide <= 0) return [];
  const sorted = [...plates].sort((a, b) => b - a);
  const out: number[] = [];
  for (const p of sorted) {
    while (perSide >= p - 1e-9) {
      out.push(p);
      perSide -= p;
    }
  }
  return out;
}

/** Closest loadable weight at or below target for the given plates/bar. */
export function closestLoadable(target: number, bar = 20, plates: number[] = DEFAULT_PLATES): number {
  const side = platesPerSide(target, bar, plates);
  return bar + 2 * side.reduce((a, b) => a + b, 0);
}
