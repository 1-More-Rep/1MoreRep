import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/guards';

// Route based on auth. First-run instance setup is added in P3.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? '/app' : '/login');
}
