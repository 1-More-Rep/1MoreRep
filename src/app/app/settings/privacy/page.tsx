import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { getPrivacy } from '@/server/social/privacy';
import { Card } from '@/components/ui/Card';
import { PrivacyForm } from '@/components/social/PrivacyForm';

export const dynamic = 'force-dynamic';

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const privacy = await getPrivacy(user.id);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/settings" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Settings</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Privacy</h1>
      <Card>
        <PrivacyForm p={privacy} />
      </Card>
    </div>
  );
}
