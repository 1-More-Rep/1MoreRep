import 'server-only';
import { z } from 'zod';
import type { Equipment } from '@prisma/client';
import type { GenGoal } from '@/domain/generator/types';
import type { LLMProvider } from './provider';
import { getConfiguredProvider } from './index';

export interface ParsedGoal {
  goal: GenGoal;
  availableTimeMin: number;
  equipment: Equipment[];
}

const EQUIP: Equipment[] = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND', 'EZ_BAR', 'BALL', 'OTHER'];

const schema = z.object({
  goal: z.enum(['HYPERTROPHY', 'STRENGTH', 'ENDURANCE', 'GENERAL']),
  availableTimeMin: z.number().int().min(10).max(180),
  equipment: z.array(z.enum(EQUIP as [Equipment, ...Equipment[]])),
});

const clampTime = (n: number) => Math.max(10, Math.min(180, Math.round(n)));

/** Deterministic keyword/regex baseline — always valid, never throws. */
export function regexParse(text: string): ParsedGoal {
  const t = text.toLowerCase();
  let goal: GenGoal = 'HYPERTROPHY';
  if (/\b(strength|stronger|heavy|powerlift|1\s*rm|max)\b/.test(t)) goal = 'STRENGTH';
  else if (/\b(endur|condition|cardio|stamina|tone)\b/.test(t)) goal = 'ENDURANCE';
  else if (/\b(general|overall|fitness|health|maintain)\b/.test(t)) goal = 'GENERAL';
  else if (/\b(hypertroph|muscle|size|build|bigger|mass|gain)\b/.test(t)) goal = 'HYPERTROPHY';

  let availableTimeMin = 60;
  const hr = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hour|hr)\b/);
  const min = t.match(/(\d+)\s*(?:min|minute|m)\b/);
  if (hr) availableTimeMin = clampTime(parseFloat(hr[1]!) * 60);
  else if (min) availableTimeMin = clampTime(parseInt(min[1]!, 10));

  const equipment: Equipment[] = [];
  const has = (re: RegExp, e: Equipment) => re.test(t) && equipment.push(e);
  has(/barbell|bar\b/, 'BARBELL');
  has(/dumbbell|db\b/, 'DUMBBELL');
  has(/machine/, 'MACHINE');
  has(/cable/, 'CABLE');
  has(/bodyweight|body\s*weight|no equipment|calisthenic/, 'BODYWEIGHT');
  has(/kettlebell|kb\b/, 'KETTLEBELL');
  has(/band/, 'BAND');

  return { goal, availableTimeMin, equipment };
}

const SYSTEM = `Extract structured workout inputs from the user's free text. Reply ONLY as JSON: {"goal":"HYPERTROPHY|STRENGTH|ENDURANCE|GENERAL","availableTimeMin":<10-180 integer>,"equipment":[<subset of BARBELL,DUMBBELL,MACHINE,CABLE,BODYWEIGHT,KETTLEBELL,BAND>]}. Empty equipment array means "any".`;

/**
 * Parse free text into validated generator inputs. Uses the LLM if reachable,
 * Zod-revalidating its output against the enums; falls back to the regex baseline
 * on unconfigured/unhealthy/timeout/parse-fail/validation-fail.
 */
export async function parseGoal(text: string, provider?: LLMProvider): Promise<ParsedGoal> {
  const baseline = regexParse(text);
  const p = provider ?? (await getConfiguredProvider());
  if (!p.isConfigured()) return baseline;
  try {
    if (!(await p.health())) return baseline;
    const { text: out } = await p.complete({ system: SYSTEM, user: text, json: true, maxTokens: 200 });
    const parsed = schema.safeParse(JSON.parse(out));
    if (!parsed.success) return baseline;
    // de-dupe equipment, keep only known values
    const equipment = [...new Set(parsed.data.equipment)].filter((e) => EQUIP.includes(e));
    return { goal: parsed.data.goal, availableTimeMin: clampTime(parsed.data.availableTimeMin), equipment };
  } catch {
    return baseline;
  }
}
