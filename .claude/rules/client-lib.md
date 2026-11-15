---
paths:
  - "client/lib/**/*.ts"
  - "client/types/**/*.ts"
---

# Client lib and types

- `lib/config.ts` is the only file that reads `process.env`. Only `NEXT_PUBLIC_*` variables: `API_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Every new one also goes in `client/.env.example`.
- `lib/axios.ts` exports one `api` instance (`baseURL: API_URL`). A **request interceptor** adds `Authorization: Bearer <accessToken>`; a **response interceptor** refreshes the token on `401` once (shared promise for concurrent requests), retries, and clears the session if refresh fails. `contexts/AxiosProvider.tsx` only provides this instance.
- `lib/storage.ts` wraps `localStorage` (SSR guard, safe JSON parse) for the session `{ user, accessToken, refreshToken, expiresAt }` and dispatches `after:session-cleared` when the session is cleared.
- `lib/errors.ts` exports `getErrorMessage(error: unknown): string` (API message → network message → generic).
- `lib/supabase.ts` exports a single browser client with the **publishable** key, used only for Realtime subscriptions.
- `types/models.ts` holds the shared domain interfaces mirroring the server's responses (dates arrive as ISO strings). Admin view models live in `lib/admin/types.ts`.
- `lib/events.ts` (`eventsCatalog`) is legacy mock data: do not import it in new code; delete it when events come from the API.
- No React imports in `lib/`.
- Never put server secrets here.

Templates: `.claude/docs/client/lib-axios-auth.md`.
