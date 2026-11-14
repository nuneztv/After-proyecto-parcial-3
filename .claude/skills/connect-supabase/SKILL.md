---
name: connect-supabase
description: Migrates one After feature from mock data (server data.mock.ts or client lib/events.ts / hard-coded providers) to Supabase Postgres, end to end. Use when connecting products, payments, clients/profiles, events, saved events or admin data to the database.
argument-hint: "<feature: products | payments | profiles | events | saved-events | admin-stats | activity>"
disable-model-invocation: true
---

# Connect a feature to Supabase

Argument: the feature to migrate (for example `events`).

Read first: `.claude/docs/project/domain.md` (target table and contract for the feature), `.claude/docs/server/db-init.md`, `.claude/docs/server/repository.md`.

## 0. Infrastructure (only the first time)

If `server/src/db/db.ts` does not exist yet, the first run also creates (via `server-writer`):

- `pg`, `@supabase/supabase-js`, `@types/pg`, `tsx` in `server/package.json`.
- `src/config.ts` DB_* and SUPABASE_* constants, and `server/.env.example`.
- `src/db/db.ts` (pool with SSL + `initDb`), `src/lib/supabase.ts`, the `app.ts` / `index.ts` split, `dev` script → `tsx watch src/index.ts`.
- `client/lib/admin/config.ts` and `client/.env.example` (the example file is shared but only documents variables; adding admin variables there is allowed).

Then tell the user exactly which values to put in `server/.env` and `client/.env.local` (where to find them in the Supabase dashboard). Never read or write those files yourself.

## 1. Plan → implement → test → review

Run the `/add-feature` flow (`feature-planner` → `server-writer` → `client-writer` → `test-writer` → `code-reviewer`) with this brief:

- **Database:** the feature's table(s) from `domain.md` in `initDb`, in FK order, plus a seed that moves today's mock rows into the table with fixed UUIDs and `ON CONFLICT (id) DO NOTHING`.
- **Repository:** `async` functions on the `pool`; nested objects with `json_build_object`; aggregates with a CTE.
- **Service/controller/router:** become `async`; controllers wrapped with `asyncHandler`; add `authMiddleware` / `requireRole('admin')` per `domain.md` (only if auth already exists; otherwise list it as a follow-up).
- **Delete** the feature's `data.mock.ts` and any client mock it replaces (`lib/events.ts` usages, hard-coded provider data, `DataProvider` pieces).
- **Client (admin folders only, see `CLAUDE.md` → "Scope"):** client infrastructure goes in `client/lib/admin/` (`config.ts`, `axios.ts`) instead of `client/lib/`, and only `contexts/admin/*` providers are migrated. User-app mocks (`DataProvider`, `lib/events.ts` used by user pages) are NOT deleted: report them as follow-ups for the teammate. The admin provider loads from the API with `loading`/`error`, shows toasts, and pages stop deriving data themselves.
- **Ids:** mock ids (`evt-1`, `prod-1`) become UUIDs; update any client code that hard-codes them (`savedIds` defaults, `item.id === 'evt-5'`).

## 2. Finish

`/verify`, then summarize for the user: tables created, seeds, routes changed, mocks deleted, and anything they must do in the Supabase dashboard.

Suggested order for After: profiles+auth (`/add-auth`) → events → products → payments → saved-events → admin stats/activity (+ `/add-realtime`).
