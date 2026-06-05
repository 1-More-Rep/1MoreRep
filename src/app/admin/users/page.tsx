import { getTranslations } from 'next-intl/server';
import { prisma } from '@/server/db/prisma';
import { getCurrentUser } from '@/lib/auth/guards';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionLabel } from '@/components/ui/typography';
import { InviteForm, UserActions } from '@/components/admin/AdminUi';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const t = await getTranslations('admin');
  const STATUS_LABEL: Record<string, string> = { ACTIVE: t('statusActive'), INVITED: t('statusInvited'), DEACTIVATED: t('statusDisabled') };
  const ROLE_LABEL: Record<string, string> = { USER: t('roleUser'), ADMIN: t('roleAdmin'), SUPERADMIN: t('roleSuperadmin') };
  const actor = await getCurrentUser();
  const isSuper = actor?.role === 'SUPERADMIN';
  const users = await prisma.user.findMany({ orderBy: [{ role: 'desc' }, { createdAt: 'asc' }] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('usersTitle')}</h1>

      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>{t('inviteAUser')}</SectionLabel>
        <InviteForm canInviteAdmin={isSuper} />
      </Card>

      <Card pad={false}>
        {users.map((u, i) => (
          <div
            key={u.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 'var(--pad)',
              borderTop: i ? '1px solid var(--line)' : 'none',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{u.displayName}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{u.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip accent={u.role !== 'USER'}>{ROLE_LABEL[u.role] ?? u.role.toLowerCase()}</Chip>
              <Chip>{STATUS_LABEL[u.status] ?? u.status}</Chip>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <UserActions
                user={{ id: u.id, email: u.email, displayName: u.displayName, role: u.role, status: u.status, self: u.id === actor?.id }}
                canManageSuperadmin={isSuper}
              />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
