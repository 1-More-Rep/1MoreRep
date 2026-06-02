import Link from 'next/link';
import { ResetForm } from '@/components/auth/ResetForm';

export default function ResetPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>Reset password</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
          We&apos;ll email you a link to set a new password.
        </p>
      </div>
      <ResetForm />
      <div style={{ fontSize: 13, textAlign: 'center' }}>
        <Link href="/login" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
