---
name: add-auth
description: Adds real authentication to After with Supabase Auth: register/login/refresh/me routes, authMiddleware and requireRole on the server; AuthProvider, session storage, axios token + refresh interceptors, session-expired handling and PrivateRoute on the client, for both the user and admin apps.
argument-hint: "[auth options]"
disable-model-invocation: true
---

# Add authentication

1. Read `.claude/docs/server/auth-middleware.md`, `.claude/docs/client/lib-axios-auth.md` and the `profiles` table in `.claude/docs/project/domain.md`.
2. Server:
   - `profiles` table in `initDb` (references `auth.users`, `role` client/admin) and a `features/profiles/` feature (replaces `features/clients/` and its mock; no endpoint returns every profile to non-admins).
   - `features/auth/` with the usual layers: `POST /register`, `POST /login`, `POST /refresh`, `GET /me`, mounted at `/api/auth`.
   - `middlewares/authMiddleware.ts` with `authMiddleware`, `requireRole`, `getUserFromRequest`; `src/shared/types.ts` with `AuthUser` and `Role`. Apply per route; admin routes add `requireRole('admin')`.
   - User-scoped tables get `user_id`; repositories filter by it.
3. Client — **admin folders only** (`CLAUDE.md` → "Scope"): map every path below to its admin equivalent (`lib/admin/axios.ts`, `lib/admin/storage.ts`, `contexts/admin/AdminAuthProvider.tsx`, `contexts/admin/ToastProvider.tsx`, `components/admin/PrivateRoute/PrivateRoute.tsx`, mounted in `contexts/admin/AdminState.tsx`). Do not touch the user app's `AuthProvider`, `Guard`, `login`/`register` pages; list them as follow-ups for the teammate.
   - `lib/config.ts`, `lib/storage.ts` (session with tokens + `after:session-cleared` event), `lib/axios.ts` (request interceptor + refresh-on-401 response interceptor), `lib/errors.ts`.
   - `contexts/AxiosProvider.tsx` provides `api`; `contexts/ToastProvider.tsx`; `contexts/AuthProvider.tsx` with `user`, `ready`, `loading`, `login`, `register`, `logout`, session-expired listener. Remove `DEMO_PASSWORDS` and the `/api/clients` call.
   - `components/PrivateRoute/PrivateRoute.tsx` (replaces `Guard`) with an optional `role`; wrap admin pages with `role="admin"`.
   - User login/register pages and admin login/register pages use the provider (controlled inputs, validation, `loading` on the button). Admin logout calls `logout()` instead of linking to `/login`.
   - Feature providers that depend on the session are keyed by `user?.id`.
   - Handle email-confirmation mode: register may return `session: null` → toast "Check your email" and go to login.
4. Tests: missing/malformed header → 401, invalid token → 401, client on admin route → 403, other user's resource → 404; login stores the session; 401 → refresh → retry; refresh failure clears the session and redirects; logout clears it.
5. Run `npm run typecheck`, `npm run lint`, `npm test` in both workspaces.
6. Tell the user to enable Email auth in Supabase (Authentication → Providers) and decide whether email confirmation stays on for the demo.
