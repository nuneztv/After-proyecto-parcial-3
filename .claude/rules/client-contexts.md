---
paths:
  - "client/contexts/**/*.tsx"
---

# Client providers (contexts)

- One file per provider: `contexts/<Name>Provider.tsx` (admin: `contexts/admin/<Name>Provider.tsx`) exporting `<Name>Provider` and the hook `use<Name>`. Always `'use client';`.
- The value is typed with an interface (`<Name>ContextValue` / `<Name>ContextType`); the context is `createContext<... | null>(null)`.
- The hook throws if the provider is missing: `throw new Error('useX must be used within XProvider')`.
- Split by domain: `AuthProvider` (session/user only), `EventsProvider`, `SavedEventsProvider`, `PaymentsProvider`, admin `EventsProvider`/`ActivityProvider`/`ProfileProvider`. Do not add more to the legacy `DataProvider`; move its pieces out as features are connected.
- The provider owns the state, loads initial data in a `useEffect`, and exposes async actions (`createEvent`, `toggleSaved`) that call the API through `useAxios()` and then update local state with functional setters.
- Every action has its own loading flag (`loading`, `creating`, `deletingId`, `saving`) set in `try/finally`, and reports errors with `showToast(getErrorMessage(err), 'error')`.
- Derived data (`happening`, `tonight`, filtered lists, stats) is computed in the provider with `useMemo`, not in pages.
- Realtime: subscribe to Supabase Broadcast in a `useEffect` and **always** `supabase.removeChannel(channel)` in the cleanup. Appends/updates are idempotent by `id`.
- Session-scoped providers are re-created per user with `key={user?.id ?? 'anonymous'}`.
- Mount providers as low in the tree as possible; cross-cutting ones (`ToastProvider`, `AxiosProvider`, `AuthProvider`) in `components/Providers.tsx`; admin ones in `contexts/admin/AdminState.tsx`.
- No mock catalogs (`lib/events.ts`) in new provider code.

Templates: `.claude/docs/client/contexts.md`, `.claude/docs/client/realtime-subscription.md`.
