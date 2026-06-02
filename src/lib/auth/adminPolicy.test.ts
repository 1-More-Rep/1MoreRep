import { describe, it, expect } from 'vitest';
import { canChangeRole, canDeactivate, canInvite, canEditSettings } from './adminPolicy';

const sa = { id: 's', role: 'SUPERADMIN' as const };
const admin = { id: 'a', role: 'ADMIN' as const };
const user = { id: 'u', role: 'USER' as const };

describe('adminPolicy.canChangeRole', () => {
  it('superadmin can promote a user to admin', () => {
    expect(canChangeRole(sa, user, 'ADMIN', 2).ok).toBe(true);
  });
  it('admin cannot grant superadmin', () => {
    expect(canChangeRole(admin, user, 'SUPERADMIN', 2).ok).toBe(false);
  });
  it('admin cannot modify a superadmin target', () => {
    expect(canChangeRole(admin, sa, 'ADMIN', 2).ok).toBe(false);
  });
  it('cannot demote the last superadmin', () => {
    expect(canChangeRole(sa, { id: 's', role: 'SUPERADMIN' }, 'ADMIN', 1).ok).toBe(false);
    expect(canChangeRole(sa, { id: 's2', role: 'SUPERADMIN' }, 'ADMIN', 2).ok).toBe(true);
  });
  it('plain users cannot change roles', () => {
    expect(canChangeRole(user, user, 'ADMIN', 2).ok).toBe(false);
  });
});

describe('adminPolicy.canDeactivate', () => {
  it('cannot deactivate yourself', () => {
    expect(canDeactivate(sa, { id: 's', role: 'SUPERADMIN' }, 2).ok).toBe(false);
  });
  it('admin cannot deactivate a superadmin', () => {
    expect(canDeactivate(admin, sa, 2).ok).toBe(false);
  });
  it('cannot deactivate the last superadmin', () => {
    expect(canDeactivate(sa, { id: 'other', role: 'SUPERADMIN' }, 1).ok).toBe(false);
  });
  it('admin can deactivate a normal user', () => {
    expect(canDeactivate(admin, user, 2).ok).toBe(true);
  });
});

describe('adminPolicy.canInvite & canEditSettings', () => {
  it('admin can invite users/admins but not superadmins', () => {
    expect(canInvite(admin, 'USER').ok).toBe(true);
    expect(canInvite(admin, 'ADMIN').ok).toBe(true);
    expect(canInvite(admin, 'SUPERADMIN').ok).toBe(false);
  });
  it('only superadmin edits settings', () => {
    expect(canEditSettings(sa).ok).toBe(true);
    expect(canEditSettings(admin).ok).toBe(false);
  });
});
