// Edge-safe auth constants (no server-only / node imports) so they can be used
// from middleware as well as server modules.
export const SESSION_COOKIE = '1mr_session';

// Password-login brute-force lockout (named so they're not inline magic numbers).
export const LOGIN_LOCK_THRESHOLD = 8; // consecutive failures before a temporary lock
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
