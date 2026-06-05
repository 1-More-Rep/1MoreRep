import { redirect } from 'next/navigation';

// Friends moved under Profile (Profile > Friends). Keep this path as a redirect
// for back-compat with older push deep-links and shared/bookmarked URLs.
export default function LegacyFriendsRedirect() {
  redirect('/app/profile/friends');
}
