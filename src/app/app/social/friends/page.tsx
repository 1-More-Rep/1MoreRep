import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { listFriends, listPendingRequests } from '@/server/social/friends';
import { getFriendStreaks } from '@/server/social/friendStreak';
import { FriendsManager } from '@/components/social/FriendsManager';

export const dynamic = 'force-dynamic';

export default async function FriendsPage() {
  const user = await requireUser();
  const [friends, requests, streaks] = await Promise.all([
    listFriends(user.id),
    listPendingRequests(user.id),
    getFriendStreaks(user.id),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Friends</h1>
      <FriendsManager
        friends={friends.map((f) => ({ id: f.id, displayName: f.displayName, publicHandle: f.publicHandle, streak: streaks[f.id] }))}
        requests={requests.map((r) => ({ id: r.id, displayName: r.displayName, publicHandle: r.publicHandle }))}
      />
    </div>
  );
}
