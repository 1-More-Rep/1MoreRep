'use server';

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { requireUser } from '@/lib/auth/guards';

// The appearance column is client-written, so it must be validated before it lands in the DB
// as JSON. `.strict()` rejects unknown keys (no unbounded blob storage) and every value is
// bounded to the known ThemeTweaks domain. `.partial()` allows storing a subset of tweaks.
const appearanceSchema = z
  .object({
    mode: z.enum(['system', 'light', 'dark']),
    dark: z.boolean(), // derived cache; accepted for back-compat but `mode` is authoritative
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    font: z.enum(['calm', 'techy', 'friendly']),
    radius: z.number().int().min(4).max(24),
    density: z.enum(['compact', 'regular', 'comfy']),
    iconStyle: z.enum(['line', 'soft', 'solid']),
  })
  .partial()
  .strict();

/** Persist the user's theme tweaks to their account so they follow across devices. */
export async function saveAppearanceAction(tweaks: Record<string, unknown>): Promise<void> {
  const user = await requireUser();
  const parsed = appearanceSchema.safeParse(tweaks);
  // Appearance is cosmetic and saved fire-and-forget (debounced); silently drop a malformed
  // payload rather than persisting arbitrary JSON or surfacing an error to the user.
  if (!parsed.success) return;
  await prisma.user.update({ where: { id: user.id }, data: { appearance: parsed.data as Prisma.InputJsonValue } });
}
