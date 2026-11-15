import { AuthTokens, StoredSession } from "@/types/models";

// The admin app uses its own key ("after-admin-session"): both apps can be logged in at once
const SESSION_KEY = "after-session";

// Fired when the session is cleared because it expired (the refresh failed)
export const SESSION_CLEARED_EVENT = "after:session-cleared";

// Sessions saved by the old mock login have no tokens: they are discarded, not trusted
const isStoredSession = (value: unknown): value is StoredSession => {
  const session = value as Partial<StoredSession> | null;
  return (
    typeof session?.accessToken === "string" &&
    typeof session.refreshToken === "string" &&
    typeof session.user?.id === "string"
  );
};

export const getStoredSession = (): StoredSession | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredSession(parsed)) return parsed;
  } catch {
    // Corrupted value: fall through and remove it
  }
  window.localStorage.removeItem(SESSION_KEY);
  return null;
};

export const setStoredSession = (session: StoredSession | null): void => {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
};

export const updateStoredTokens = (tokens: AuthTokens): void => {
  const current = getStoredSession();
  if (current) setStoredSession({ ...current, ...tokens });
};

// Where to go after a Google/Apple sign-in: the ?next= of the login page survives the trip to the
// provider in sessionStorage (this tab only)
const OAUTH_NEXT_KEY = "after-oauth-next";

export const setOAuthNext = (next: string): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(OAUTH_NEXT_KEY, next);
};

// Read once: the value is removed so an old destination never leaks into a later sign-in
export const takeOAuthNext = (): string | null => {
  if (typeof window === "undefined") return null;
  const next = window.sessionStorage.getItem(OAUTH_NEXT_KEY);
  window.sessionStorage.removeItem(OAUTH_NEXT_KEY);
  return next;
};

export const expireStoredSession = (): void => {
  setStoredSession(null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  }
};

