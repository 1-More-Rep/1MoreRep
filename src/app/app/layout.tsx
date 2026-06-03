import type { ReactNode } from 'react';
import { AppShell } from '@/components/nav/AppShell';
import { requireUser, hasRole } from '@/lib/auth/guards';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(); // redirects to /login when unauthenticated
  return (
    <>
      <ImpersonationBanner />
      <AppShell isAdmin={hasRole(user, 'ADMIN')}>{children}</AppShell>
    </>
  );
}
