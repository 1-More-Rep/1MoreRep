import type { ReactNode } from 'react';
import { AppShell } from '@/components/nav/AppShell';

// Auth gating is added in P2; for now the app chrome is open so nav + screens
// can be built and verified.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
