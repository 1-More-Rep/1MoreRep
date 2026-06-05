import type { Role } from '@prisma/client';

export interface PolicyActor {
  id: string;
  role: Role;
}
export interface PolicyTarget {
  id: string;
  role: Role;
}

export interface PolicyResult {
  ok: boolean;
  reason?: string;
}

const ALLOW: PolicyResult = { ok: true };
const deny = (reason: string): PolicyResult => ({ ok: false, reason });

const RANK: Record<Role, number> = { USER: 0, ADMIN: 1, SUPERADMIN: 2 };

/** Can `actor` change `target`'s role to `newRole`? */
export function canChangeRole(
  actor: PolicyActor,
  target: PolicyTarget,
  newRole: Role,
  superadminCount: number,
): PolicyResult {
  if (RANK[actor.role] < RANK.ADMIN) return deny('Insufficient privileges');
  // Only a superadmin may grant or modify the SUPERADMIN role.
  if ((newRole === 'SUPERADMIN' || target.role === 'SUPERADMIN') && actor.role !== 'SUPERADMIN') {
    return deny('Only a superadmin can manage superadmins');
  }
  // Admins cannot elevate above their own rank.
  if (actor.role === 'ADMIN' && RANK[newRole] > RANK.ADMIN) return deny('Admins cannot grant that role');
  // Protect the last superadmin from demotion.
  if (target.role === 'SUPERADMIN' && newRole !== 'SUPERADMIN' && superadminCount <= 1) {
    return deny('Cannot demote the last superadmin');
  }
  return ALLOW;
}

/** Can `actor` reactivate (un-deactivate) `target`? Symmetric to {@link canDeactivate}. */
export function canReactivate(actor: PolicyActor, target: PolicyTarget): PolicyResult {
  if (RANK[actor.role] < RANK.ADMIN) return deny('Insufficient privileges');
  // An admin must not be able to override a superadmin's active-state decisions.
  if (target.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
    return deny('Only a superadmin can reactivate a superadmin');
  }
  return ALLOW;
}

/** Can `actor` deactivate `target`? */
export function canDeactivate(
  actor: PolicyActor,
  target: PolicyTarget,
  superadminCount: number,
): PolicyResult {
  if (RANK[actor.role] < RANK.ADMIN) return deny('Insufficient privileges');
  if (actor.id === target.id) return deny('You cannot deactivate yourself');
  if (target.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
    return deny('Only a superadmin can deactivate a superadmin');
  }
  if (target.role === 'SUPERADMIN' && superadminCount <= 1) {
    return deny('Cannot deactivate the last superadmin');
  }
  return ALLOW;
}

/** Can `actor` invite a new user with `newRole`? */
export function canInvite(actor: PolicyActor, newRole: Role): PolicyResult {
  if (RANK[actor.role] < RANK.ADMIN) return deny('Insufficient privileges');
  if (newRole === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') return deny('Only a superadmin can invite superadmins');
  if (actor.role === 'ADMIN' && RANK[newRole] > RANK.ADMIN) return deny('Admins cannot invite that role');
  return ALLOW;
}

/** Only superadmins may edit instance settings. */
export function canEditSettings(actor: PolicyActor): PolicyResult {
  return actor.role === 'SUPERADMIN' ? ALLOW : deny('Only a superadmin can edit instance settings');
}
