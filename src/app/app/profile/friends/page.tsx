import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { listFriends, listPendingRequests } from '@/server/social/friends';
import { getFriendStreaks } from '@/server/social/friendStreak';
import { getPrivacy } from '@/server/social/privacy';
import { FriendsManager } from '@/components/social/FriendsManager';

export const dynamic = 'force-dynamic';

export default async function FriendsPage() {
  const t = await getTranslations('friends');
  const user = await requireUser();
  const [friends, requests, streaks, privacy] = await Promise.all([
    listFriends(user.id),
    listPendingRequests(user.id),
    getFriendStreaks(user.id),
    getPrivacy(user.id),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/profile" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {t('backToProfile')}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('heading')}</h1>
      <FriendsManager
        friends={friends.map((f) => ({ id: f.id, displayName: f.displayName, publicHandle: f.publicHandle, streak: streaks[f.id] }))}
        requests={requests.map((r) => ({ id: r.id, displayName: r.displayName, publicHandle: r.publicHandle }))}
        searchable={privacy?.searchableByHandle ?? true}
      />
    </div>
  );
}
