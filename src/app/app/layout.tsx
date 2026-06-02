import type { ReactNode } from 'react';
import { AppShell } from '@/components/nav/AppShell';
import { requireUser } from '@/lib/auth/guards';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser(); // redirects to /login when unauthenticated
  return <AppShell>{children}</AppShell>;
}
