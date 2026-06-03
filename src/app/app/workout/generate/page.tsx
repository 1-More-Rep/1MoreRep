import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { GeneratorFlow } from '@/components/workout/GeneratorFlow';

export const dynamic = 'force-dynamic';

export default async function GenerateWorkoutPage() {
  await requireUser();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 560 }}>
      <Link href="/app/workout/new" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Start a workout</Link>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Generate a workout</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>
          We&apos;ll pick exercises for muscles that are recovered and under-trained.
        </p>
      </div>
      <GeneratorFlow />
    </div>
  );
}
