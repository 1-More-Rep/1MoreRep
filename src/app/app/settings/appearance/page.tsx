import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { AppearanceControls } from '@/components/settings/AppearanceControls';

export const dynamic = 'force-dynamic';

export default async function AppearanceSettingsPage() {
  await requireUser();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 520 }}>
      <Link href="/app/settings" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Settings</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Appearance</h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>Personalise the look. Changes apply instantly and are saved to your account, so they follow you on every device.</p>
      <AppearanceControls />
    </div>
  );
}
