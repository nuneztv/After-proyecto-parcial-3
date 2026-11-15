# After — Claude Code harness

After is a nightlife app for Cali: users discover events (map, search, saved events, tickets) and administrators run them live (overview, live control, capacity, activity). Monorepo with `client/` (Next.js) and `server/` (Express + TypeScript), backed by **Supabase** (Postgres, Auth, Realtime, Storage).

All Claude configuration lives in `.claude/`. Long reference material lives in `.claude/docs/` and is loaded on demand. The domain model, database tables, realtime contract and the list of what is still missing are in `.claude/docs/project/domain.md`: read it before planning any feature.

## Project shape

```
After-app/
├── client/   Next.js 16 (App Router), React 19, plain CSS (globals.css, admin.css), axios, leaflet
└── server/   Express 4, TypeScript (CommonJS), @hapi/boom, pg + @supabase/supabase-js
```

- **Server:** `src/features/<feature>/<entity>.{router,controller,service,repository,types}.ts` (folder plural, files singular: `features/products/product.service.ts`). Layered: router → controller → service → repository. Plus `src/config.ts` (the only `process.env` reader), `src/db/` (pg pool + `initDb`), `src/lib/` (supabase client, realtime broadcast), `src/middlewares/` (`errorsMiddleware.ts` + `asyncHandler`, `authMiddleware.ts`), `src/shared/` (cross-feature types).
- **Client:** `app/` (routes; user app at `/`, admin app at `/admin`), `components/` (one component per folder: `components/<Name>/<Name>.tsx`, admin ones in `components/admin/<Name>/<Name>.tsx`), `contexts/` (`<Name>Provider.tsx`; admin ones in `contexts/admin/`), `hooks/`, `lib/` (`config.ts`, `axios.ts`, `storage.ts`, `errors.ts`, `supabase.ts`), `types/models.ts` (shared domain types). Imports use the `@/` alias.

## Scope: this developer owns the ADMIN app + the server

There is no top-level `admin/` folder: the admin app lives inside `client/`. All client work goes **only** in the admin folders:

| Allowed (admin) | Not allowed without asking (user app, owned by a teammate) |
|-----------------|-------------------------------------------------------------|
| `client/app/admin/**` (incl. `admin.css`) | `client/app/*` outside `admin/` (`home`, `login`, `events`...) |
| `client/components/admin/**` | `client/components/*.tsx` (flat user components) |
| `client/contexts/admin/**` | `client/contexts/*Provider.tsx` (`AuthProvider`, `DataProvider`, `AxiosProvider`) |
| `client/lib/admin/**` | `client/lib/*.ts`, `client/types/models.ts`, `client/components/Providers.tsx` |
| `client/hooks/admin/**` (create if needed) | `client/app/layout.tsx`, `client/app/globals.css` |
| `server/**` (any feature, the API is shared) | |

- Admin infrastructure lives in admin folders: `lib/admin/config.ts`, `lib/admin/axios.ts` (token + refresh interceptor), `lib/admin/storage.ts`, `lib/admin/errors.ts`, `lib/admin/supabase.ts`, `lib/admin/types.ts`, `contexts/admin/AdminAuthProvider.tsx`, `contexts/admin/ToastProvider.tsx`, `components/admin/PrivateRoute/`. They are mounted from `contexts/admin/AdminState.tsx` / `app/admin/layout.tsx`.
- The docs show templates with user-app paths (`lib/axios.ts`, `contexts/AuthProvider.tsx`); for this developer, map them to the admin paths above.
- Admin code must not import from the user app's `contexts/` or `lib/events.ts`. Shared read-only imports (`types/models.ts`) are fine.
- If a task truly needs a change outside these folders (other than `server/`), **stop and ask** the user before touching it.

## Commands

Run inside the workspace you changed. Root: `npm run install:all`, `npm run dev` (server :4000 + client :3001).

| Workspace | Install | Dev | Typecheck | Lint | Test |
|-----------|---------|-----|-----------|------|------|
| `server/` | `npm install` | `npm run dev` | `npm run typecheck` | `npm run lint` | `npm test` (`node:test` via `tsx`) |
| `client/` | `npm install` | `npm run dev` | `npm run typecheck` | `npm run lint` | `npm test` (Vitest + Testing Library) |

Some of these scripts do not exist yet (see "Known gaps" in `.claude/docs/project/domain.md`). The first agent that needs one adds it as described in `.claude/docs/server/env-config.md` / `.claude/docs/client/testing.md`.

## Rules (loaded by file path)

Rules in `.claude/rules/` load automatically when a matching file is edited:

- `server-layers.md`, `server-db.md`, `server-errors-auth.md` for `server/src/**`
- `client-components.md`, `client-hooks.md`, `client-contexts.md`, `client-lib.md` for `client/**`
- `typescript-style.md` for every `*.ts` / `*.tsx`
- `tests.md` for test files

## Skills

| Skill | Use it to |
|-------|-----------|
| `/add-feature` | Orchestrate a full feature (plan → server → client → tests → review) |
| `/add-server-feature` | Add a layered server feature |
| `/add-client-feature` | Add a client feature (components + provider + hooks) |
| `/connect-supabase` | Replace a feature's `data.mock.ts` with a Supabase table, async repository and real provider data |
| `/add-component`, `/add-context`, `/add-hook` | Add one client building block |
| `/add-db-table` | Add a table, its `initDb` entry and a repository |
| `/add-realtime` | Add Supabase Realtime Broadcast events (server emits, providers subscribe) |
| `/add-file-upload` | Add file uploads (multer + Supabase Storage), e.g. event images |
| `/add-auth` | Add Supabase Auth (login, register, refresh, roles) on server and client |
| `/verify` | Run typecheck, lint and tests in both workspaces |

## Agents

Agents never call each other: the orchestrating skill runs them **one at a time, in order**.

1. `feature-planner`: read-only; produces the API contract, tables, files and test cases.
2. `server-writer`: writes only under `server/` (no tests).
3. `client-writer`: writes only under `client/` (no tests).
4. `test-writer`: writes only test files.
5. `code-reviewer`: read-only; ends with `APPROVED` or `CHANGES REQUIRED`.

## Docs (on-demand)

`.claude/docs/` holds the detailed patterns and code templates. Start from `.claude/docs/README.md` (the index) and read only what the task needs.

## Conventions

- Code, comments, identifiers and API error messages are in English. Conversation with the team can be in Spanish.
- Every behavior change ships with tests.
- Never read or edit `.env` files; update `.env.example` instead.
- Secrets stay on the server (`SUPABASE_SECRET_KEY`, DB password). Client env vars are `NEXT_PUBLIC_*` and public only (the Next.js equivalent of Vite's `VITE_*`).
- Mock data (`data.mock.ts`, `client/lib/events.ts`, hard-coded admin profile) is legacy: new code reads from Supabase through the API; do not add more mocks.
- Callbacks receive data, not DOM events: `onDelete(id)`, `onSelect(eventId)`, never `onDelete(e, id)`.
- Every async action in the UI has a loading flag (`loading`, `creating`, `deleting`, `saving`), an error toast and a disabled button while in flight.

## Before calling a task done

1. `npm run typecheck` passes in every touched workspace.
2. `npm run lint` passes.
3. `npm test` is green.
4. `code-reviewer` returned `APPROVED`.

Headless version of the whole flow: `bash ./.claude/scripts/harness.sh "feature description"`.
