import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { Alert } from '@/components/auth/ui';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth/guards';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; next?: string }>;
}) {
  if (await getCurrentUser()) redirect('/app');
  const sp = await searchParams;
  const settings = await getSettings();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>Sign in</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>Welcome back.</p>
      </div>

      {sp.verified && <Alert kind="notice">Email verified — you can sign in now.</Alert>}

      <LoginForm />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <Link href="/reset" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>
          Forgot password?
        </Link>
        {settings.allowSelfRegistration && (
          <Link href="/register" style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600 }}>
            Create account
          </Link>
        )}
      </div>
    </div>
  );
}
