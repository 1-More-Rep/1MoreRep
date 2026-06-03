'use server';

import { redirect } from 'next/navigation';
import type { Equipment } from '@prisma/client';
import { requireUser } from '@/lib/auth/guards';
import { generatePlan, createSessionFromPlan, type GenerateOptions } from '@/server/services/generatorService';
import { explainPlan } from '@/server/llm/explain';
import type { GenGoal, GeneratorPlan } from '@/domain/generator/types';

export interface GenerateResult {
  plan: GeneratorPlan;
  explanation: string;
}

export async function generatePlanAction(opts: { goal: GenGoal; availableTimeMin: number; equipment: Equipment[] }): Promise<GenerateResult> {
  const user = await requireUser();
  const genOpts: GenerateOptions = { goal: opts.goal, availableTimeMin: opts.availableTimeMin, equipment: opts.equipment };
  const plan = await generatePlan(user.id, genOpts);
  const explanation = await explainPlan(plan);
  return { plan, explanation };
}

export async function startFromPlanAction(plan: GeneratorPlan, goal: GenGoal): Promise<void> {
  const user = await requireUser();
  await createSessionFromPlan(user.id, plan, 'Generated workout', goal);
  redirect('/app/workout/active');
}
