'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Equipment } from '@prisma/client';
import { requireUser } from '@/lib/auth/guards';
import { rateLimit } from '@/lib/ratelimit';
import { generatePlan, swapPlanExercise, createSessionFromPlan, type GenerateOptions } from '@/server/services/generatorService';
import { explainPlan } from '@/server/llm/explain';
import { adjustDifficulty, type Direction } from '@/server/llm/adjustDifficulty';
import { parseGoal, type ParsedGoal } from '@/server/llm/parseGoal';
import type { GenGoal, GeneratorPlan } from '@/domain/generator/types';

const MAX_GOAL_TEXT = 500;

// Server-action params are untrusted at runtime (the TS types are erased). Validate the
// generator inputs so a crafted client can't drive the engine with an absurd time budget
// or an invalid goal/equipment value.
const genInputsSchema = z.object({
  goal: z.enum(['HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'GENERAL']),
  availableTimeMin: z.number().int().min(10).max(240),
  equipment: z
    .array(z.enum(['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND', 'EZ_BAR', 'BALL', 'OTHER']))
    .max(20),
});

function parseGenInputs(opts: GenInputs): GenInputs {
  const parsed = genInputsSchema.safeParse(opts);
  if (!parsed.success) throw new Error('Invalid generator inputs.');
  return parsed.data;
}

/** Throttle the (potentially LLM-backed, expensive) generator actions per user. */
async function llmGate(userId: string): Promise<void> {
  const rl = await rateLimit.auth(`llm:${userId}`);
  if (!rl.ok) throw new Error('Too many requests — wait a moment and try again.');
}

export interface GenerateResult {
  plan: GeneratorPlan;
  explanation: string;
}

export interface GenInputs {
  goal: GenGoal;
  availableTimeMin: number;
  equipment: Equipment[];
}

export async function generatePlanAction(rawOpts: GenInputs): Promise<GenerateResult> {
  const user = await requireUser();
  await llmGate(user.id);
  const opts = parseGenInputs(rawOpts);
  const genOpts: GenerateOptions = { goal: opts.goal, availableTimeMin: opts.availableTimeMin, equipment: opts.equipment };
  const plan = await generatePlan(user.id, genOpts);
  const explanation = await explainPlan(plan);
  return { plan, explanation };
}

/** Swap one slot for the next-best alternative for the same muscle. */
export async function swapExerciseAction(rawOpts: GenInputs, plan: GeneratorPlan, index: number): Promise<GenerateResult> {
  const user = await requireUser();
  await llmGate(user.id);
  const opts = parseGenInputs(rawOpts);
  const next = await swapPlanExercise(user.id, opts, plan, index);
  const explanation = await explainPlan(next);
  return { plan: next, explanation };
}

/** Make the plan harder/easier (LLM with deterministic fallback). */
export async function adjustDifficultyAction(plan: GeneratorPlan, direction: Direction): Promise<GenerateResult> {
  const user = await requireUser();
  await llmGate(user.id);
  const next = await adjustDifficulty(plan, direction);
  const explanation = await explainPlan(next);
  return { plan: next, explanation };
}

/** Parse a free-text goal into structured generator inputs. */
export async function parseGoalAction(text: string): Promise<ParsedGoal> {
  const user = await requireUser();
  await llmGate(user.id);
  // Cap length before it reaches the LLM: bounds prompt-injection surface + token cost.
  return parseGoal(text.slice(0, MAX_GOAL_TEXT));
}

export async function startFromPlanAction(plan: GeneratorPlan, goal: GenGoal): Promise<void> {
  const user = await requireUser();
  await createSessionFromPlan(user.id, plan, 'Generated workout', goal);
  redirect('/app/workout/active');
}
