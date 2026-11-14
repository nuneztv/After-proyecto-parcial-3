---
name: add-context
description: Adds a React provider (contexts/<Name>Provider.tsx + use<Name> hook) that loads After data from the API, exposes actions with loading flags and toasts, and optionally subscribes to Supabase Realtime. Use for shared client state.
argument-hint: "<Domain, e.g. SavedEvents>"
---

# Add a provider

Argument: the domain (for example `SavedEvents` or `admin/Activity`).

1. Read `.claude/rules/client-contexts.md`, `.claude/docs/client/contexts.md` and the provider map in `.claude/docs/project/domain.md`.
2. If realtime is involved, also read `.claude/docs/client/realtime-subscription.md`.
3. Add shared types to `client/types/models.ts` (admin view models: `client/lib/admin/types.ts`) if missing.
4. Create `client/contexts/<Name>Provider.tsx` (admin: `client/contexts/admin/<Name>Provider.tsx`) exporting `<Name>Provider` and `use<Name>`; get axios with `useAxios()` and toasts with `useToast()`.
5. Mount it in the page/layout that needs it, as low as possible (admin: `contexts/admin/AdminState.tsx`). If it replaces part of `DataProvider`, remove that part.
6. Add tests (`renderHook` with the provider as wrapper, `@/lib/axios` mocked) per `.claude/docs/client/testing.md`.
7. Run `npm run typecheck`, `npm run lint` and `npm test` in `client/`.
