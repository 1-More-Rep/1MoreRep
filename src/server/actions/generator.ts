'use server';

import { redirect } from 'next/navigation';
import type { Equipment } from '@prisma/client';
import { requireUser } from '@/lib/auth/guards';
import { generatePlan, swapPlanExercise, createSessionFromPlan, type GenerateOptions } from '@/server/services/generatorService';
import { explainPlan } from '@/server/llm/explain';
import { adjustDifficulty, type Direction } from '@/server/llm/adjustDifficulty';
import { parseGoal, type ParsedGoal } from '@/server/llm/parseGoal';
import type { GenGoal, GeneratorPlan } from '@/domain/generator/types';

export interface GenerateResult {
  plan: GeneratorPlan;
  explanation: string;
}

export interface GenInputs {
  goal: GenGoal;
  availableTimeMin: number;
  equipment: Equipment[];
}

export async function generatePlanAction(opts: GenInputs): Promise<GenerateResult> {
  const user = await requireUser();
  const genOpts: GenerateOptions = { goal: opts.goal, availableTimeMin: opts.availableTimeMin, equipment: opts.equipment };
  const plan = await generatePlan(user.id, genOpts);
  const explanation = await explainPlan(plan);
  return { plan, explanation };
}

/** Swap one slot for the next-best alternative for the same muscle. */
export async function swapExerciseAction(opts: GenInputs, plan: GeneratorPlan, index: number): Promise<GenerateResult> {
  const user = await requireUser();
  const next = await swapPlanExercise(user.id, opts, plan, index);
  const explanation = await explainPlan(next);
  return { plan: next, explanation };
}

/** Make the plan harder/easier (LLM with deterministic fallback). */
export async function adjustDifficultyAction(plan: GeneratorPlan, direction: Direction): Promise<GenerateResult> {
  await requireUser();
  const next = await adjustDifficulty(plan, direction);
  const explanation = await explainPlan(next);
  return { plan: next, explanation };
}

/** Parse a free-text goal into structured generator inputs. */
export async function parseGoalAction(text: string): Promise<ParsedGoal> {
  await requireUser();
  return parseGoal(text);
}

export async function startFromPlanAction(plan: GeneratorPlan, goal: GenGoal): Promise<void> {
  const user = await requireUser();
  await createSessionFromPlan(user.id, plan, 'Generated workout', goal);
  redirect('/app/workout/active');
}
