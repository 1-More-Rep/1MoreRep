import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { AccountForm } from '@/components/settings/AccountForm';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const user = await requireUser();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/settings" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Settings</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Account</h1>
      <AccountForm displayName={user.displayName} unitSystem={user.unitSystem} timezone={user.timezone} email={user.email} />
    </div>
  );
}
