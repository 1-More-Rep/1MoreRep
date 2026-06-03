export const metadata = { title: 'Offline · 1MoreRep' };

export default function OfflinePage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 'var(--screen-pad)', background: 'var(--bg)', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 'var(--r)', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>1R</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>You&apos;re offline</h1>
      <p style={{ color: 'var(--text-2)', maxWidth: 360, margin: 0 }}>Reconnect to sync your workouts. Anything you logged is saved locally and will catch up.</p>
    </main>
  );
}
