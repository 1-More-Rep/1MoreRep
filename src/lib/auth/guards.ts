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
