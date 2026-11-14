# `lib/`: config, axios (token + refresh), storage, errors, auth

## `lib/config.ts` — the only reader of `process.env`

```ts
// NEXT_PUBLIC_* are inlined at build time and visible in the browser (Next's equivalent of VITE_*)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
```

Today `AxiosProvider` reads `process.env.NEXT_PUBLIC_API_URL` itself: move it here.

`client/.env.example`:

```
# Express API (no trailing slash; request paths already start with /api)
NEXT_PUBLIC_API_URL=http://localhost:4000
# Supabase (Project Settings > API). Publishable/anon key only: it is public
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Real values go in `client/.env.local` (git-ignored). Never put the secret key here.

## `lib/storage.ts` — session in localStorage

Already exists (`after-session`, saved ids). Extend it to store the session tokens next to the user:

```ts
import type { SessionUser, StoredSession } from '@/types/models';

const SESSION_KEY = 'after-session';
export const SESSION_CLEARED_EVENT = 'after:session-cleared';

export const getStoredSession = (): StoredSession | null => { /* safe JSON parse, SSR guard */ };
export const setStoredSession = (session: StoredSession | null) => { /* set or remove */ };

export const clearStoredSession = () => {
  setStoredSession(null);
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
};
```

`StoredSession = { user: SessionUser; accessToken: string; refreshToken: string; expiresAt: number }`. Saved event ids move to the API (`/api/saved-events`); remove the localStorage version and the hard-coded `cli-1` defaults once that feature is connected.

## `lib/axios.ts` — one instance, token + automatic refresh

```ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './config';
import { clearStoredSession, getStoredSession, setStoredSession } from './storage';

export const api = axios.create({ baseURL: API_URL, timeout: 12000 });

api.interceptors.request.use((config) => {
  const session = getStoredSession();

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return config;
});

// Concurrent 401s share one refresh request
let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const session = getStoredSession();
  if (!session?.refreshToken) return null;

  try {
    // Plain axios, not `api`: the refresh call must not go through this interceptor
    const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
      refreshToken: session.refreshToken,
    });
    setStoredSession({ ...session, ...data });
    return data.accessToken as string;
  } catch {
    return null;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthRoute = original?.url?.startsWith('/api/auth/');

    if (error.response?.status !== 401 || !original || original._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    original._retry = true;
    refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
    const token = await refreshing;

    if (!token) {
      // Session expired: AuthProvider listens to this event, clears state and redirects
      clearStoredSession();
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);
```

Keep the axios error as-is (do not wrap it in `new Error`, as the current `AxiosProvider` does): `getErrorMessage` reads it, and tests can check `status`.

`contexts/AxiosProvider.tsx` stays as a thin provider: `<AxiosContext.Provider value={api}>`, so existing `useAxios()` callers keep working and tests can inject a mock instance.

## `lib/errors.ts`

```ts
import { isAxiosError } from 'axios';

export const getErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    if (!error.response) return 'We could not reach the After API';
    return error.response.data?.message ?? error.message;
  }

  return error instanceof Error ? error.message : 'Something went wrong';
};
```

## `lib/supabase.ts` (Realtime only)

```ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
```

## `contexts/AuthProvider.tsx` (the "UserProvider")

All auth logic lives here, never in pages:

```tsx
interface AuthContextValue {
  user: SessionUser | null;
  ready: boolean;        // session read from storage (avoid redirect flicker)
  loading: boolean;      // login/register in flight
  login: (email: string, password: string) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => void;
}
```

- `useEffect` on mount: read `getStoredSession()`, set `user`, `setReady(true)`. Optionally validate with `GET /api/auth/me`.
- `login`: `api.post('/api/auth/login')` → `setStoredSession` → `setUser` → `router.push(user.role === 'admin' ? '/admin/overview' : '/home')`; on error `showToast(getErrorMessage(err), 'error')`.
- `register`: same; when `session` is `null` (email confirmation enabled) show "Check your email" and go to login.
- `logout`: `clearStoredSession()`, `setUser(null)`, `router.replace('/login')` (admin → `/admin/login`).
- Session expired: listen to `SESSION_CLEARED_EVENT` on `window` (cleanup in the effect's return), `setUser(null)`, toast "Your session expired", redirect.
- Remove `DEMO_PASSWORDS` and the `GET /api/clients` call: the browser must never download every user.

## `PrivateRoute`

```tsx
export const PrivateRoute = ({ children, role }: { children: ReactNode; role?: Role }) => {
  const { user, ready } = useAuth();
  const router = useRouter();
  const allowed = !!user && (!role || user.role === role);

  useEffect(() => {
    if (ready && !allowed) router.replace(role === 'admin' ? '/admin/login' : '/login');
  }, [ready, allowed, role, router]);

  if (!ready) return <Spinner />;
  return allowed ? <>{children}</> : null;
};
```

Admin pages: wrap once in `app/admin/(panel)/layout.tsx` (and the other admin pages outside `(panel)`) with `role="admin"`.

`localStorage` tokens are readable by any script on the page: never render untrusted HTML.
