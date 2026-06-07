import type { Role } from '@prisma/client';

export interface PolicyActor {
  id: string;
  role: Role;
}
export interface PolicyTarget {
  id: string;
  role: Role;
}

/**
 * Stable, locale-independent denial codes. The action layer maps these to a localized
 * message (i18n namespace `adminErr`, where the keys match these codes) so an admin's
 * account language governs the text — the domain layer stays free of UI strings.
 */
export type PolicyCode =
  | 'insufficientPrivileges'
  | 'superadminOnlyManage'
  | 'adminsCannotGrantRole'
  | 'cannotDemoteLastSuperadmin'
  | 'superadminOnlyReactivate'
  | 'cannotDeactivateSelf'
  | 'superadminOnlyDeactivate'
  | 'cannotDeactivateLastSuperadmin'
  | 'superadminOnlyInvite'
  | 'adminsCannotInviteRole'
  | 'superadminOnlyEditSettings';

export interface PolicyResult {
  ok: boolean;
  code?: PolicyCode;
}

const ALLOW: PolicyResult = { ok: true };
const deny = (code: PolicyCode): PolicyResult => ({ ok: false, code });

const RANK: Record<Role, number> = { USER: 0, ADMIN: 1, SUPERADMIN: 2 };

/** Can `actor` change `target`'s role to `newRole`? */
export function canChangeRole(
  actor: PolicyActor,
  target: PolicyTarget,
  newRole: Role,
  superadminCount: number,
): PolicyResult {
  if (RANK[actor.role] < RANK.ADMIN) return deny('insufficientPrivileges');
  // Only a superadmin may grant or modify the SUPERADMIN role.
  if ((newRole === 'SUPERADMIN' || target.role === 'SUPERADMIN') && actor.role !== 'SUPERADMIN') {
    return deny('superadminOnlyManage');
  }
  // Admins cannot elevate above their own rank.
  if (actor.role === 'ADMIN' && RANK[newRole] > RANK.ADMIN) return deny('adminsCannotGrantRole');
  // Protect the last superadmin from demotion.
  if (target.role === 'SUPERADMIN' && newRole !== 'SUPERADMIN' && superadminCount <= 1) {
    return deny('cannotDemoteLastSuperadmin');
  }
  return ALLOW;
}

/** Can `actor` reactivate (un-deactivate) `target`? Symmetric to {@link canDeactivate}. */
export function canReactivate(actor: PolicyActor, target: PolicyTarget): PolicyResult {
  if (RANK[actor.role] < RANK.ADMIN) return deny('insufficientPrivileges');
  // An admin must not be able to override a superadmin's active-state decisions.
  if (target.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
    return deny('superadminOnlyReactivate');
  }
  return ALLOW;
}

/** Can `actor` deactivate `target`? */
export function canDeactivate(
  actor: PolicyActor,
  target: PolicyTarget,
  superadminCount: number,
): PolicyResult {
  if (RANK[actor.role] < RANK.ADMIN) return deny('insufficientPrivileges');
  if (actor.id === target.id) return deny('cannotDeactivateSelf');
  if (target.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
    return deny('superadminOnlyDeactivate');
  }
  if (target.role === 'SUPERADMIN' && superadminCount <= 1) {
    return deny('cannotDeactivateLastSuperadmin');
  }
  return ALLOW;
}

/** Can `actor` invite a new user with `newRole`? */
export function canInvite(actor: PolicyActor, newRole: Role): PolicyResult {
  if (RANK[actor.role] < RANK.ADMIN) return deny('insufficientPrivileges');
  if (newRole === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') return deny('superadminOnlyInvite');
  if (actor.role === 'ADMIN' && RANK[newRole] > RANK.ADMIN) return deny('adminsCannotInviteRole');
  return ALLOW;
}

/** Only superadmins may edit instance settings. */
export function canEditSettings(actor: PolicyActor): PolicyResult {
  return actor.role === 'SUPERADMIN' ? ALLOW : deny('superadminOnlyEditSettings');
}
