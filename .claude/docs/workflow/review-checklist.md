# Review checklist (for `code-reviewer`)

Mark each item pass / fail / not applicable. Every fail is a blocker with `file:line`. The checklist mirrors the course rubric.

## Architecture & scaffolding

- [ ] Each server feature has its own `router`, `controller`, `service`, `repository`, `types` files under `features/<feature>/`.
- [ ] Each new client component lives in its own folder (`components/<Name>/<Name>.tsx` or `components/admin/<Name>/<Name>.tsx`), one component per file.
- [ ] Cross-feature types live in `server/src/shared/` and `client/types/`; no duplicated interfaces inside components.

## Server

- [ ] Imports only go router → controller → service → repository. No SQL outside repositories; no `req`/`res` in services; no business rules in controllers.
- [ ] Every async handler and async middleware is wrapped with `asyncHandler` (Express 4).
- [ ] All SQL parameterized; nested objects built with `json_build_object` / `json_agg`; multi-stat queries use a CTE instead of several round trips.
- [ ] Controller validates type, shape and ranges; throws `Boom.badRequest`.
- [ ] Correct status codes (201 create, 200 read, 204 delete) and Boom statuses (401/403/404/409/502).
- [ ] Protected routes use `authMiddleware` per route; admin routes add `requireRole('admin')`; handlers use `getUserFromRequest`.
- [ ] User-scoped data (`payments`, `saved_events`) filters by `user_id`; foreign rows return 404. No endpoint returns every user to the browser.
- [ ] Realtime broadcast after a successful write, fire-and-forget, payload matches the REST shape.
- [ ] `initDb` additions are idempotent and never drop/alter tables.
- [ ] Env vars only read in `src/config.ts`; `server/.env.example` updated; `.env` untouched.
- [ ] `errorsMiddleware` registered after all routers; 5xx responses do not leak internal messages.
- [ ] Build layout unchanged: `tsconfig.json` keeps `rootDir: "src"` and `include: ["src"]`.

## Client

- [ ] Providers have typed `<Name>ContextValue` interfaces; the hook throws outside its provider.
- [ ] Auth logic only in `AuthProvider`; feature data only in feature providers; pages contain no business logic or API calls.
- [ ] `api` from `lib/axios.ts` (via `useAxios`): token in a request interceptor, refresh on 401 in a response interceptor, session-expired → logout + redirect.
- [ ] Protected pages wrapped in `PrivateRoute` (admin pages with `role="admin"`).
- [ ] Every async action has a loading flag (`loading`, `creating`, `deleting`, `sending`), a disabled button and an error toast; forms validate before sending.
- [ ] Loading, empty and error states rendered with dedicated UI (`EmptyState`, spinner).
- [ ] Callbacks receive data (`onDelete(id)`), not DOM events.
- [ ] Realtime subscriptions are in providers, cleaned up with `removeChannel`, updates are idempotent by `id`.
- [ ] Only `NEXT_PUBLIC_*` variables; `lib/config.ts` is the only env reader; `client/.env.example` updated; no secrets.
- [ ] No new mock data; legacy mocks replaced by the feature are deleted.
- [ ] Accessible labels on inputs and buttons; errors use `role="alert"`.

## Tests

- [ ] Happy path, validation errors, not found, ownership/unauthorized/forbidden, side effects.
- [ ] Expected values written by hand; no weakened assertions to hide a bug.
- [ ] No `any`, `@ts-ignore`, `.only`, or skipped tests without a reason.

## General

- [ ] No `any`, no `@ts-ignore`, no leftover `console.log`.
- [ ] Code, identifiers and messages in English.
- [ ] `typecheck`, `lint` and `test` pass in every touched workspace (or the missing script is reported).
- [ ] Nothing outside the plan's scope. Exception: a minimal, behaviour-preserving fix to a pre-existing error that blocks a required check, reported by the writer, is a suggestion, not a blocker.
