---
name: add-realtime
description: Adds Supabase Realtime Broadcast events across After: the backend sends (channel, event, payload) from a service and the frontend Providers receive them. Use when changes (new events, occupancy, activity) must reach other users without a refresh.
argument-hint: "<events and channel>"
disable-model-invocation: true
---

# Add realtime events (Supabase Broadcast)

Argument: the events (for example `event-updated on channel events`).

Read: `.claude/docs/server/realtime-supabase.md`, `.claude/docs/client/realtime-subscription.md`, and the "Realtime contract" in `.claude/docs/project/domain.md`.

Steps:

1. Define/confirm the contract: channel name, event names (kebab-case, past tense), payload shape (= REST response shape, or `{ id }` for deletions). If it is new, add the row to the contract table in `domain.md`.
2. Server: create `src/lib/realtime.ts` (`broadcast`) if missing. Emit **from the service** after the repository call succeeds. Fire-and-forget: log failures, never throw.
3. Client: create `lib/supabase.ts` (publishable key) and add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `lib/config.ts` and `client/.env.example` if missing. Subscribe inside the provider's `useEffect`, `removeChannel` in the cleanup, upsert by `id`.
4. Tests: the service broadcasts on success and not on failure; the provider updates state once when the event arrives twice; the channel is removed on unmount.
5. Run `npm run typecheck`, `npm run lint`, `npm test` in both workspaces.

Never expose the secret key to the client and never broadcast user-scoped data (payments, emails).
