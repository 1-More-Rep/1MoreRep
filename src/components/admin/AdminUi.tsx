'use client';

import { useActionState } from 'react';
import type { Role } from '@prisma/client';
import {
  inviteUserAction,
  setRoleAction,
  toggleActiveAction,
  resetUserAction,
  impersonateUserAction,
  type AdminState,
} from '@/server/actions/admin';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { Alert, TextField } from '@/components/auth/ui';

const empty: AdminState = {};

export function InviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const [state, action] = useActionState(inviteUserAction, empty);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Alert kind="error">{state.error}</Alert>
      <Alert kind="notice">{state.notice}</Alert>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <TextField label="Email" name="email" type="email" placeholder="person@example.com" required />
        </div>
        <select name="role" defaultValue="USER" aria-label="Role" style={selectStyle}>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
          {canInviteAdmin && <option value="SUPERADMIN">Superadmin</option>}
        </select>
        <Btn type="submit" icon="plus">Invite</Btn>
      </div>
    </form>
  );
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status: string;
  self: boolean;
}

export function UserActions({ user, canManageSuperadmin }: { user: AdminUserRow; canManageSuperadmin: boolean }) {
  const [roleState, roleAction] = useActionState(setRoleAction, empty);
  const [activeState, activeAction] = useActionState(toggleActiveAction, empty);
  const [resetState, resetAction] = useActionState(resetUserAction, empty);
  const [impState, impAction] = useActionState(impersonateUserAction, empty);
  const deactivated = user.status === 'DEACTIVATED';
  const err = roleState.error || activeState.error || resetState.error || impState.error;
  // An admin must not impersonate a superadmin; nobody impersonates themselves or a disabled account.
  const canImpersonate = !user.self && !deactivated && (user.role !== 'SUPERADMIN' || canManageSuperadmin);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <form action={roleAction}>
          <input type="hidden" name="targetId" value={user.id} />
          <select name="role" defaultValue={user.role} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label={`Role for ${user.email}`} style={selectStyleSm}>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
            {canManageSuperadmin && <option value="SUPERADMIN">Superadmin</option>}
          </select>
        </form>
        <form action={resetAction}>
          <input type="hidden" name="targetId" value={user.id} />
          <Btn type="submit" kind="ghost" size="sm">Reset</Btn>
        </form>
        {canImpersonate && (
          <form action={impAction}>
            <input type="hidden" name="targetId" value={user.id} />
            <Btn type="submit" kind="ghost" size="sm" icon="user">View as</Btn>
          </form>
        )}
        {!user.self && (
          <form action={activeAction}>
            <input type="hidden" name="targetId" value={user.id} />
            <input type="hidden" name="activate" value={deactivated ? '1' : '0'} />
            <Btn type="submit" kind={deactivated ? 'soft' : 'ghost'} size="sm">
              {deactivated ? 'Reactivate' : 'Deactivate'}
            </Btn>
          </form>
        )}
      </div>
      {err && <Chip style={{ color: '#c0392b' }}>{err}</Chip>}
      {resetState.notice && <Chip accent>{resetState.notice}</Chip>}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  height: 46,
  padding: '0 12px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font-sans)',
};
const selectStyleSm: React.CSSProperties = { ...selectStyle, height: 36, fontSize: 13 };
