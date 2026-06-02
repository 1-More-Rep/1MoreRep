import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth/guards';

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/app');
  const settings = await getSettings();
  if (!settings.allowSelfRegistration) redirect('/login');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>Create account</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>Join {settings.brandName}.</p>
      </div>
      <RegisterForm />
      <div style={{ fontSize: 13, textAlign: 'center' }}>
        <Link href="/login" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  );
}
