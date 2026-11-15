import { AuthTokens, StoredSession } from "@/types/models";

// The admin app uses its own key ("after-admin-session"): both apps can be logged in at once
const SESSION_KEY = "after-session";
const SAVED_KEY = "after-saved";

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

export const expireStoredSession = (): void => {
  setStoredSession(null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  }
};

export const getSavedIds = (userId: string): string[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(`${SAVED_KEY}-${userId}`);
  if (!raw) return userId === "cli-1" ? ["evt-1", "evt-4", "evt-5"] : [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
};

export const setSavedIds = (userId: string, ids: string[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${SAVED_KEY}-${userId}`, JSON.stringify(ids));
};
