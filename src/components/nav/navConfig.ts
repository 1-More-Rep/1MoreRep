import type { IconName } from '@/components/ui/Icon';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
}

/** Desktop sidebar destinations (matches the design's sidebar menu). */
export const SIDEBAR_NAV: NavItem[] = [
  { id: 'today', label: 'Today', icon: 'home', href: '/app' },
  { id: 'workouts', label: 'Workouts', icon: 'dumbbell', href: '/app/workouts' },
  { id: 'exercises', label: 'Exercises', icon: 'weight', href: '/app/exercises' },
  { id: 'muscle', label: 'Recovery', icon: 'heart', href: '/app/muscle' },
  { id: 'progress', label: 'Progress', icon: 'chart', href: '/app/progress' },
  { id: 'history', label: 'History', icon: 'history', href: '/app/history' },
  { id: 'social', label: 'Social', icon: 'trophy', href: '/app/social' },
];

/** Mobile bottom-tab destinations; the center `add` is an action, not a route. */
export const MOBILE_TABS: ({ id: string; icon: IconName; label: string; href: string } | { id: 'add' })[] = [
  { id: 'today', icon: 'home', label: 'Today', href: '/app' },
  { id: 'history', icon: 'history', label: 'History', href: '/app/history' },
  { id: 'add' },
  { id: 'progress', icon: 'chart', label: 'Progress', href: '/app/progress' },
  { id: 'profile', icon: 'user', label: 'Profile', href: '/app/profile' },
];

/** Active when the path equals the href or is nested beneath it (but '/app' only exact). */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}
