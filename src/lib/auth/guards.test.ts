import { describe, it, expect } from 'vitest';
import type { Role, User } from '@prisma/client';
import { hasRole, requireOwnership, AuthorizationError } from './guards';

function u(role: Role, id = 'u1'): User {
  return { id, role } as User;
}

describe('RBAC matrix (hasRole)', () => {
  const cases: Array<[Role, Role, boolean]> = [
    ['USER', 'USER', true],
    ['USER', 'ADMIN', false],
    ['USER', 'SUPERADMIN', false],
    ['ADMIN', 'USER', true],
    ['ADMIN', 'ADMIN', true],
    ['ADMIN', 'SUPERADMIN', false],
    ['SUPERADMIN', 'USER', true],
    ['SUPERADMIN', 'ADMIN', true],
    ['SUPERADMIN', 'SUPERADMIN', true],
  ];
  it.each(cases)('role %s meets min %s => %s', (role, min, expected) => {
    expect(hasRole(u(role), min)).toBe(expected);
  });
});

describe('requireOwnership', () => {
  it('allows the owner', () => {
    expect(() => requireOwnership(u('USER', 'a'), 'a')).not.toThrow();
  });
  it('blocks a non-owner (even admins — no override of member data)', () => {
    expect(() => requireOwnership(u('ADMIN', 'a'), 'b')).toThrow(AuthorizationError);
  });
});
