import 'server-only';
import { z } from 'zod';
import type { GeneratorPlan, PlannedExercise } from '@/domain/generator/types';
import type { LLMProvider } from './provider';
import { getConfiguredProvider } from './index';

export type Direction = 'harder' | 'easier';

const SETS_MIN = 1;
const SETS_MAX = 6;
const REPS_MIN = 1;
const REPS_MAX = 30;
const RPE_MIN = 5;
const RPE_MAX = 10;
const STEP = 0.05; // ±5% load nudge
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Deterministic, always-available difficulty patch (the LLM fallback). */
export function deterministicAdjust(plan: GeneratorPlan, dir: Direction): GeneratorPlan {
  const sign = dir === 'harder' ? 1 : -1;
  const exercises: PlannedExercise[] = plan.exercises.map((e) => {
    const load = e.loadSuggestionKg != null ? Math.round(e.loadSuggestionKg * (1 + sign * STEP) * 2) / 2 : e.loadSuggestionKg;
    return {
      ...e,
      sets: clamp(e.sets + (dir === 'harder' ? 1 : -1), SETS_MIN, SETS_MAX),
      rpeTarget: clamp(Math.round((e.rpeTarget + sign * 0.5) * 2) / 2, RPE_MIN, RPE_MAX),
      loadSuggestionKg: load,
    };
  });
  return { exercises, rationale: [...plan.rationale, `Adjusted ${dir} (deterministic).`] };
}

const SYSTEM = `You are a strength coach adjusting an EXISTING workout's difficulty. You may ONLY change sets, repLow, repHigh, loadSuggestionKg, and rpeTarget for the exercises given — never add, remove, rename, or invent exercises. Reply as JSON: {"adjustments":[{"exerciseId","sets","repLow","repHigh","loadSuggestionKg","rpeTarget"}]}. Keep changes modest and safe.`;

// Validate the LLM's JSON shape at the trust boundary instead of a bare `as` cast. Field
// values are still clamped below — this just guarantees the top-level structure and types
// before we touch them (a wrong-typed field is dropped rather than silently coerced).
const llmResponseSchema = z.object({
  adjustments: z
    .array(
      z.object({
        exerciseId: z.string().optional(),
        sets: z.number().optional(),
        repLow: z.number().optional(),
        repHigh: z.number().optional(),
        loadSuggestionKg: z.number().nullable().optional(),
        rpeTarget: z.number().optional(),
      }),
    )
    .optional(),
});

/**
 * Adjust a plan's difficulty up/down. Uses the configured LLM when reachable,
 * re-validating every patch against the plan's own exercises (rejecting
 * out-of-catalog ids) and clamping absurd loads/sets/reps. Falls back to the
 * deterministic baseline on unconfigured/unhealthy/timeout/parse-fail.
 * `provider` is injectable for tests.
 */
export async function adjustDifficulty(plan: GeneratorPlan, dir: Direction, provider?: LLMProvider): Promise<GeneratorPlan> {
  const baseline = deterministicAdjust(plan, dir);
  const p = provider ?? (await getConfiguredProvider());
  if (!p.isConfigured()) return baseline;
  try {
    if (!(await p.health())) return baseline;
    const user = JSON.stringify({
      direction: dir,
      exercises: plan.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: e.sets, repLow: e.repLow, repHigh: e.repHigh, loadSuggestionKg: e.loadSuggestionKg, rpeTarget: e.rpeTarget })),
    });
    const { text } = await p.complete({ system: SYSTEM, user, json: true, maxTokens: 500 });
    const parsed = llmResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success || !parsed.data.adjustments) return baseline;

    const byId = new Map(parsed.data.adjustments.filter((a) => typeof a.exerciseId === 'string').map((a) => [a.exerciseId!, a]));
    let applied = 0;
    const exercises = plan.exercises.map((e) => {
      const a = byId.get(e.exerciseId); // out-of-catalog adjustments are simply never matched here
      if (!a) return e;
      applied++;
      const orig = e.loadSuggestionKg;
      // clamp load to ±50% of the original (reject absurd values), preserve null
      const load =
        orig != null && typeof a.loadSuggestionKg === 'number' && Number.isFinite(a.loadSuggestionKg)
          ? clamp(a.loadSuggestionKg, orig * 0.5, orig * 1.5)
          : orig;
      const repLow = typeof a.repLow === 'number' ? clamp(Math.round(a.repLow), REPS_MIN, REPS_MAX) : e.repLow;
      const repHigh = typeof a.repHigh === 'number' ? clamp(Math.round(a.repHigh), repLow, REPS_MAX) : Math.max(repLow, e.repHigh);
      return {
        ...e,
        sets: typeof a.sets === 'number' ? clamp(Math.round(a.sets), SETS_MIN, SETS_MAX) : e.sets,
        repLow,
        repHigh,
        rpeTarget: typeof a.rpeTarget === 'number' ? clamp(a.rpeTarget, RPE_MIN, RPE_MAX) : e.rpeTarget,
        loadSuggestionKg: load,
      };
    });
    if (applied === 0) return baseline; // nothing valid applied
    return { exercises, rationale: [...plan.rationale, `Adjusted ${dir}.`] };
  } catch {
    return baseline;
  }
}
