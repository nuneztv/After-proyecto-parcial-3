# Docs index

On-demand reference for skills, agents and rules. Read only the page the task needs.

## Project (`.claude/docs/project/`)

| Page | Read it when |
|------|--------------|
| `domain.md` | **Always before planning**: apps, target tables, API contract, realtime contract, providers, known gaps |

## Server (`.claude/docs/server/`)

| Page | Read it when |
|------|--------------|
| `layers.md` | Adding any feature; folder map and request flow |
| `router-controller.md` | Writing routes, `asyncHandler`, input validation, status codes |
| `service.md` | Business rules, ownership, broadcasts, calling other services |
| `repository.md` | Writing SQL: CRUD, `json_build_object` for nested objects, CTEs |
| `db-init.md` | Adding tables, foreign keys, seeds; Supabase connection |
| `errors-boom.md` | Choosing error statuses; `errorsMiddleware` |
| `auth-middleware.md` | Supabase Auth, login/refresh, `authMiddleware`, `requireRole` |
| `file-upload.md` | multer + Supabase Storage (event images) |
| `realtime-supabase.md` | Server broadcasts through Supabase Realtime |
| `env-config.md` | `src/config.ts`, env vars, `app.ts` / `index.ts`, scripts, ESLint |
| `testing.md` | Server tests and tooling setup |

## Client (`.claude/docs/client/`)

| Page | Read it when |
|------|--------------|
| `components.md` | Writing components and pages (folder per component, states, callbacks) |
| `contexts.md` | Providers: state, API actions, loading flags, toasts |
| `hooks.md` | Reusable logic |
| `lib-axios-auth.md` | `lib/config.ts`, `lib/axios.ts` (token + refresh interceptor), session storage, `AuthProvider`, `PrivateRoute` |
| `realtime-subscription.md` | Subscribing to Supabase Broadcast in providers |
| `file-upload.md` | Upload hook for event images |
| `testing.md` | Client tests and tooling setup |

## Workflow (`.claude/docs/workflow/`)

| Page | Read it when |
|------|--------------|
| `api-contract-template.md` | Planning a feature |
| `review-checklist.md` | Reviewing changes |

Stack versions in this repo: Node 22.3+ (Node 24 is installed; `node:test` module mocks need 22.3+), TypeScript 5, **Express 4** (async errors need `asyncHandler`), Next.js 16.4, React 19.3, plain CSS (no Tailwind), `pg` 8, `@supabase/supabase-js` 2, `@hapi/boom` 10, leaflet 1.9.
