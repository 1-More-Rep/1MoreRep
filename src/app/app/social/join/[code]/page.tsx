import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { peekInvite } from '@/server/social/inviteLink';
import { AcceptInvite } from '@/components/social/AcceptInvite';
import { Card, Icon } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function JoinInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  // Read-only peek — accepting happens on an explicit button press, not on GET.
  const invite = await peekInvite(code, user.id);
  const inviterName = invite.creator?.displayName ?? 'Someone';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/profile/friends" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Friends</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Invite</h1>
      <Card style={{ padding: 'calc(var(--pad) * 1.5)' }}>
        {invite.error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--r-pill)',
                background: 'var(--surface-2)',
                color: 'var(--text-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="x" size={24} stroke={2} />
            </span>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{invite.error}</div>
          </div>
        ) : invite.self ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>This is your own invite link.</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-3)' }}>Share it with a friend so they can connect with you.</div>
          </div>
        ) : (
          <AcceptInvite code={code} inviterName={inviterName} />
        )}
      </Card>
    </div>
  );
}
