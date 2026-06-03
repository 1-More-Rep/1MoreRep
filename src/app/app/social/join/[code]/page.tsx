import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { acceptInvite } from '@/server/social/inviteLink';
import { Btn, Card, Icon } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function JoinInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  const result = await acceptInvite(code, user.id);
  const ok = !!result.ok;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Invite</h1>
      <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: 'calc(var(--pad) * 1.5)' }}>
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--r-pill)',
            background: ok ? 'var(--accent-soft)' : 'var(--surface-2)',
            color: ok ? 'var(--accent-text)' : 'var(--text-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={ok ? 'check' : 'x'} size={24} stroke={2} />
        </span>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{ok ? 'You are now friends!' : (result.error ?? 'This invite could not be accepted.')}</div>
        <Btn href="/app/social/friends" icon="user">Go to friends</Btn>
      </Card>
    </div>
  );
}
