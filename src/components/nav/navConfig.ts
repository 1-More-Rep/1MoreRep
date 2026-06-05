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
  { id: 'muscle', label: 'Muscles', icon: 'heart', href: '/app/muscle' },
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

/**
 * Secondary destinations surfaced through the mobile "More" menu (and the desktop
 * sidebar covers them too). Guarantees every route — including the ones that
 * aren't bottom-tabs (Workouts, Muscles, Exercises, Social, Friends) — has a
 * discoverable home on a phone.
 */
export const MORE_NAV: NavItem[] = [
  { id: 'workouts', label: 'Workouts', icon: 'dumbbell', href: '/app/workouts' },
  { id: 'exercises', label: 'Exercises', icon: 'weight', href: '/app/exercises' },
  { id: 'muscle', label: 'Muscles', icon: 'heart', href: '/app/muscle' },
  { id: 'social', label: 'Social & leagues', icon: 'trophy', href: '/app/social' },
  { id: 'friends', label: 'Friends', icon: 'users', href: '/app/profile/friends' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '/app/settings' },
  { id: 'feedback', label: 'Help & feedback', icon: 'megaphone', href: '/app/feedback' },
];

/** Active when the path equals the href or is nested beneath it (but '/app' only exact). */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}
