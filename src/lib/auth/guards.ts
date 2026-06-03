import 'server-only';
import { redirect } from 'next/navigation';
import type { Role, User } from '@prisma/client';
import { validateSession } from './session';

const RANK: Record<Role, number> = { USER: 0, ADMIN: 1, SUPERADMIN: 2 };

export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/** The current user or null. Safe in RSC, route handlers, and server actions. */
export async function getCurrentUser(): Promise<User | null> {
  const s = await validateSession();
  return s?.user ?? null;
}

export interface Impersonation {
  /** The user currently being viewed-as (governs access while impersonating). */
  user: User;
  /** The real admin's userId who started the impersonation. */
  impersonatorId: string;
}

/**
 * If the current session is an impersonation, returns the impersonated user and
 * the real admin's id so a layout can render an "Exit" banner. Returns null when
 * not impersonating. Does NOT alter requireUser/requireRole semantics — the
 * impersonated user's own role continues to govern access.
 */
export async function getImpersonation(): Promise<Impersonation | null> {
  const s = await validateSession();
  if (!s?.impersonatorId) return null;
  return { user: s.user, impersonatorId: s.impersonatorId };
}

/** Require an authenticated user; redirect to /login otherwise. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Require at least the given role; redirect (unauth) or throw (forbidden). */
export async function requireRole(min: Role): Promise<User> {
  const user = await requireUser();
  if (RANK[user.role] < RANK[min]) throw new AuthorizationError();
  return user;
}

/** Require the acting user to own a resource (strict; no admin override of member data). */
export function requireOwnership(user: User, resourceUserId: string): void {
  if (user.id !== resourceUserId) throw new AuthorizationError();
}

export function hasRole(user: Pick<User, 'role'>, min: Role): boolean {
  return RANK[user.role] >= RANK[min];
}
