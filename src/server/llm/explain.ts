import 'server-only';
import type { GeneratorPlan } from '@/domain/generator/types';
import type { LLMProvider } from './provider';
import { getConfiguredProvider } from './index';

/** Always-available, deterministic prose explanation built from the plan's rationale. */
export function deterministicExplanation(plan: GeneratorPlan): string {
  const reasons = plan.rationale.filter((r) => !r.startsWith('Forced')).slice(0, 4);
  const muscles = [...new Set(plan.exercises.map((e) => e.primaryMuscle))];
  const head = `A ${plan.exercises.length}-exercise session targeting ${muscles.length} muscle group${muscles.length === 1 ? '' : 's'}, prioritising recovered and under-trained areas.`;
  return reasons.length ? `${head} ${reasons.join('; ')}.` : head;
}

const SYSTEM = `You are a concise strength coach. Explain the GIVEN workout plan in 2-3 friendly sentences. Do NOT invent exercises, weights, or claims beyond the provided data. No markdown.`;

/**
 * Narrate a plan. Uses the configured LLM if reachable; otherwise (unconfigured,
 * unhealthy, timeout, empty, or error) falls back to the deterministic baseline.
 * `provider` is injectable for tests.
 */
export async function explainPlan(plan: GeneratorPlan, provider?: LLMProvider): Promise<string> {
  const baseline = deterministicExplanation(plan);
  const p = provider ?? (await getConfiguredProvider());
  if (!p.isConfigured()) return baseline;
  try {
    if (!(await p.health())) return baseline;
    const user = JSON.stringify({
      exercises: plan.exercises.map((e) => ({ name: e.name, muscle: e.primaryMuscle, sets: e.sets, reps: `${e.repLow}-${e.repHigh}` })),
      rationale: plan.rationale,
    });
    const { text } = await p.complete({ system: SYSTEM, user, maxTokens: 200 });
    const clean = text.trim();
    return clean.length > 0 ? clean : baseline;
  } catch {
    return baseline;
  }
}
