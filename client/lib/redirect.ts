import type { UserProfile } from '@/types/models';

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/home';
export const NON_CLIENT_MESSAGE =
  'This is an administrator account. Please sign in from the admin app.';

// Only "client" accounts use the user app (roles come from profiles.role on the server)
export const canUseClientApp = (user: Pick<UserProfile, 'role'> | null | undefined): boolean =>
  user?.role === 'client';

// Pages that must never be a post-login destination: going back to them would loop, and the
// admin app has its own login
const BLOCKED_PREFIXES = ['/login', '/register', '/forgot-password', '/admin'];
const MAX_NEXT_LENGTH = 512;
const BASE = 'http://after.local';

const isBlocked = (pathname: string): boolean =>
  pathname === '/' ||
  BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// Turns the ?next= value into a same-origin path, or HOME_PATH. Rejects absolute URLs,
// protocol-relative ("//evil.com") and backslash tricks ("/\evil.com"), control characters and
// auth pages, so the redirect can neither leave the app nor bounce back to /login
export const getSafeNextPath = (raw: string | null | undefined): string => {
  if (!raw || raw.length > MAX_NEXT_LENGTH) return HOME_PATH;
  // eslint-disable-next-line no-control-regex
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f]/.test(raw)) {
    return HOME_PATH;
  }

  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE || isBlocked(url.pathname)) return HOME_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return HOME_PATH;
  }
};

// /login?next=<where the user wanted to go>. A destination that would not be accepted on the
// way back is left out, so the login URL stays clean
export const buildLoginPath = (currentPath: string): string => {
  const next = getSafeNextPath(currentPath);
  return next === HOME_PATH && currentPath !== HOME_PATH
    ? LOGIN_PATH
    : `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
};

// Reads ?next= from a query string such as window.location.search
export const getNextFromSearch = (search: string): string =>
  getSafeNextPath(new URLSearchParams(search).get('next'));
