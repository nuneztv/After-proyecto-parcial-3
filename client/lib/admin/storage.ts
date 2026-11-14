import type { AdminSession, AuthTokens } from './types';

// Separate key from the user app's "after-session": both apps can be logged in at once
const SESSION_KEY = 'after-admin-session';

// Fired when the session is cleared because it expired (refresh failed)
export const ADMIN_SESSION_EXPIRED_EVENT = 'after:admin-session-expired';

export const getAdminSession = (): AdminSession | null => {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
};

export const setAdminSession = (session: AdminSession | null): void => {
  if (typeof window === 'undefined') return;

  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
};

export const updateAdminTokens = (tokens: AuthTokens): void => {
  const current = getAdminSession();
  if (current) setAdminSession({ ...current, ...tokens });
};

export const expireAdminSession = (): void => {
  setAdminSession(null);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
  }
};
