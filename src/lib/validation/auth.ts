import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

// Reasonable password policy: length-first (NIST), block trivially short.
export const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(200);

export const handleSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/i, 'Letters, numbers and underscores only');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const magicRequestSchema = z.object({
  email: emailSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1).max(60),
  handle: handleSchema,
  password: passwordSchema,
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const setPasswordSchema = z.object({
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
