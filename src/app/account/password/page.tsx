import { requireUser } from '@/lib/auth/guards';
import { SetPasswordForm } from '@/components/auth/SetPasswordForm';
import { Icon } from '@/components/ui/Icon';

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; reset?: string; force?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const heading = sp.welcome ? 'Set your password' : sp.reset ? 'Choose a new password' : 'Update password';

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: 'var(--screen-pad)',
        background: 'var(--bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="bolt" size={23} stroke={2.1} />
        </span>
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow)',
          padding: 'calc(var(--pad) * 1.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>{heading}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '6px 0 0' }}>Use at least 10 characters.</p>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}
