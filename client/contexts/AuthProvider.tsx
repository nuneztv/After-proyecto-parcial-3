"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { useAxios } from "./AxiosProvider";
import { AuthResponse, RegisterInput, UserProfile } from "@/types/models";
import { getErrorMessage } from "@/lib/errors";
import { SESSION_CLEARED_EVENT, getStoredSession, setStoredSession } from "@/lib/storage";
import { LOGIN_PATH, NON_CLIENT_MESSAGE, buildLoginPath, canUseClientApp } from "@/lib/redirect";

// "confirm": the account was created but Supabase asks the user to confirm the email first
export type RegisterResult = "logged-in" | "confirm" | null;

interface AuthContextType {
  user: UserProfile | null;
  // true once the stored session has been read and checked with GET /api/auth/me
  ready: boolean;
  // a login or register request is in flight
  loading: boolean;
  // a logout request is in flight
  loggingOut: boolean;
  // true from a voluntary logout until /login is reached: meanwhile PrivateRoute redirects to a
  // plain /login, because leaving the app on purpose must not record a ?next= destination
  signedOut: boolean;
  // last login/register/session problem, shown inline by the auth screens
  error: string;
  clearError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  // Always ends logged out, even when the API call fails
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const axios = useAxios();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();

  // The logout ends when /login is reached: from then on, opening a protected page records
  // ?next= again (e.g. a link to /events/123 opened after logging out)
  useEffect(() => {
    if (signedOut && pathname === LOGIN_PATH) setSignedOut(false);
  }, [signedOut, pathname]);
  const logoutInFlight = useRef(false);

  // An admin account is never kept in the user app: its Supabase session is revoked right away
  // (best-effort) so its refresh token cannot be reused. No accessToken: the stored one is sent
  const revokeSession = useCallback(
    async (accessToken?: string) => {
      try {
        await axios.post(
          "/api/auth/logout",
          null,
          accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined
        );
      } catch (err) {
        console.error("Could not revoke the administrator session", err);
      }
    },
    [axios]
  );

  // localStorage only exists in the browser, so the session is restored after hydration. The
  // stored profile is confirmed with the API: a 401 there goes through the refresh flow, and a
  // failed refresh fires SESSION_CLEARED_EVENT (handled below)
  useEffect(() => {
    const stored = getStoredSession();

    if (!stored) {
      setReady(true);
      return;
    }

    // The stored role is only a hint until GET /api/auth/me confirms it
    setUser(canUseClientApp(stored.user) ? stored.user : null);
    // Ignores a check that finished after unmount (Strict Mode runs this effect twice in dev)
    let active = true;

    const onInit = async () => {
      try {
        const { data } = await axios.get<UserProfile>("/api/auth/me");
        const current = getStoredSession();

        if (active && current && !canUseClientApp(data)) {
          await revokeSession();
          setStoredSession(null);
          setUser(null);
          setError(NON_CLIENT_MESSAGE);
        } else if (active && current) {
          setStoredSession({ ...current, user: data });
          setUser(data);
        }
      } catch (err) {
        // 401 = expired session, already handled by SESSION_CLEARED_EVENT. Any other failure
        // (network, server) keeps the stored session so the user can keep browsing
        if (!isAxiosError(err) || err.response?.status !== 401) {
          console.error("Could not verify the session", err);
        }
      } finally {
        if (active) setReady(true);
      }
    };

    void onInit();

    return () => {
      active = false;
    };
  }, [axios, revokeSession]);

  useEffect(() => {
    const onCleared = () => {
      setUser(null);
      setError("Your session expired, please log in again");
      // Back to the same page after logging in again
      const { pathname, search } = window.location;
      router.replace(buildLoginPath(`${pathname}${search}`));
    };

    window.addEventListener(SESSION_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, onCleared);
  }, [router]);

  const clearError = useCallback(() => setError(""), []);

  const startSession = useCallback((data: AuthResponse) => {
    if (!data.session) return;

    setStoredSession({ ...data.session, user: data.user });
    setSignedOut(false);
    setUser(data.user);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError("");

    try {
      const { data } = await axios.post<AuthResponse>("/api/auth/login", { email, password });

      // POST /api/auth/login accepts any role: the user app only lets "client" accounts in
      if (!canUseClientApp(data.user)) {
        await revokeSession(data.session?.accessToken);
        setError(NON_CLIENT_MESSAGE);
        return false;
      }

      // GuestRoute (around /login) sees the new user and redirects to ?next= or /home
      startSession(data);
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (input: RegisterInput): Promise<RegisterResult> => {
    setLoading(true);
    setError("");

    try {
      const { data } = await axios.post<AuthResponse>("/api/auth/register", input);

      if (!data.session) return "confirm";

      // /api/auth/register always creates "client" accounts; GuestRoute (around /register)
      // redirects to ?next= or /home
      startSession(data);
      return "logged-in";
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // A ref, not the state: a second click in the same render must not send a second request
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLoggingOut(true);

    try {
      // Revokes this session's refresh token on the server. An /api/auth/ route, so a 401 here
      // is never refreshed and retried by the interceptor
      await axios.post("/api/auth/logout");
    } catch (err) {
      // Best-effort: an expired session or an API failure must not keep the user logged in
      console.error("Logout request failed", err);
    } finally {
      setStoredSession(null);
      // Set together with the user so PrivateRoute never sees "no user" without it
      setSignedOut(true);
      setUser(null);
      setError("");
      logoutInFlight.current = false;
      setLoggingOut(false);
      router.replace(LOGIN_PATH);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, ready, loading, loggingOut, signedOut, error, clearError, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
