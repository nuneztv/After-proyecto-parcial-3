# After: domain, target data model and known gaps

Read this before planning any feature. It is the single place that describes what After *is*, what the database should look like once Supabase is connected, and what is still mock or missing.

## Two apps, one backend

| App | Routes | Who | Main screens |
|-----|--------|-----|--------------|
| User app | `/`, `/login`, `/register`, `/forgot-password`, `/home`, `/search`, `/map`, `/events/[id]`, `/directions/[id]`, `/saved-events`, `/products/[id]`, `/profile` | role `client` | discover events, filter by category/status/distance, save events, see tickets, profile with history |
| Admin app | `/admin/login`, `/admin/register`, `/admin/overview`, `/admin/events`, `/admin/events/new`, `/admin/live`, `/admin/live/[id]`, `/admin/map`, `/admin/profile` | role `admin` | stats, live events, capacity control, activity feed, create events |

Both apps talk to the same Express API (`/api/*`). Supabase is used **through the server** for data (pg pool), auth (Supabase Auth) and storage; the browser only uses Supabase directly to **subscribe** to Realtime Broadcast channels with the publishable key.

## Current state (what exists today)

| Area | Today | Source |
|------|-------|--------|
| Products (tickets) | `GET /api/products`, `GET /api/products/:id` | `server/src/features/products/data.mock.ts` |
| Clients (users) | `GET /api/clients`, `GET /api/clients/:id` (password stripped in service) | `server/src/features/clients/data.mock.ts` |
| Payments | `GET /api/payments`, `GET /api/payments/:id` | `server/src/features/payments/data.mock.ts` |
| Events | Supabase tables `events` + `event_activity`, read-only API `GET /api/events*` (user app still reads the legacy client catalog) | `server/src/features/events/`, `client/lib/events.ts` (`eventsCatalog`) |
| Saved events | localStorage per user | `client/lib/storage.ts` |
| User login | fake: fetches all clients and compares against `DEMO_PASSWORDS` in `AuthProvider` | `client/contexts/AuthProvider.tsx` |
| Admin login/register | Supabase Auth via `/api/auth/admin/*`, session + refresh in `lib/admin/axios.ts` | `client/contexts/admin/AdminAuthProvider.tsx` |
| Admin events / activity / profile | from `/api/events`, `/api/events/stats`, `/api/events/activity`, `/api/auth/me` | `client/contexts/admin/*Provider.tsx` |
| Create / edit event | `POST /api/events` (`EventsProvider.createEvent`) and `PATCH /api/events/:id` (`EventsProvider.updateEvent`, `saving`); shared `EventForm mode="create"|"edit"` on `/admin/events/new` and `/admin/events/[id]/edit`; drafts keyed `new` / `edit:<id>` in `EventDraftProvider`, location picked on `/admin/map?draft=<key>` (Leaflet `LocationPicker`) | `client/components/admin/EventForm/`, `client/contexts/admin/EventDraftProvider.tsx`, `client/lib/admin/drafts.ts` |

## Target database (Supabase Postgres)

Created idempotently in `server/src/db/db.ts` → `initDb()` (see `.claude/docs/server/db-init.md`). Ids are `uuid`; timestamps are `timestamptz`.

```
profiles(
  id uuid pk references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique not null,
  email text not null,
  avatar_url text,
  role text not null default 'client' check (role in ('client','admin')),
  created_at timestamptz not null default now()
)

events(
  id uuid pk default gen_random_uuid(),
  title text not null,
  description text not null default '',
  venue_name text not null,
  address text not null,
  image_url text,
  categories text[] not null default '{}',          -- 'music','party','rooftop','bar','concert'
  status text not null default 'open'
    check (status in ('live','open','almost-full','closed')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  latitude double precision not null,
  longitude double precision not null,
  capacity int not null check (capacity > 0),
  occupied int not null default 0 check (occupied >= 0),
  rating numeric(2,1) not null default 0,
  section text check (section in ('happening','tonight','trending')),
  map_label text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
)

products(                                            -- tickets for an event
  id uuid pk default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  category text not null default 'ticket',
  price int not null check (price >= 0),             -- COP, no decimals
  currency text not null default 'COP',
  description text not null default '',
  image_url text
)

payments(
  id uuid pk default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  amount int not null,
  currency text not null default 'COP',
  status text not null check (status in ('paid','pending','failed')),
  created_at timestamptz not null default now()
)

saved_events(
  user_id uuid references profiles(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
)

event_activity(
  id uuid pk default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
)
```

Notes:

- `profiles` replaces the mock `Client`. Passwords live only in Supabase Auth, never in our tables.
- `products.event_id` replaces today's fragile match by name (`products.find((p) => p.name === event.title)`).
- `distanceKm` is **not stored**: it depends on the user. Compute it in SQL from `latitude/longitude` query params (haversine) or on the client.
- Admin status (`live | upcoming | closed`) is a mapping of the stored status (`open`/`almost-full` → `upcoming`); keep the mapping in one function, not in each component.
- `displayDate` / `displayTime` are formatted on the client from `startsAt` / `endsAt`.
- Seed: move the current mocks into `initDb` seeds with `ON CONFLICT DO NOTHING` so the demo keeps working.

## Target API contract (summary)

| Method + path | Auth | Purpose |
|---------------|------|---------|
| `POST /api/auth/register` | no | Supabase `signUp` + `profiles` row with role `client` → `201 { user, session }` (`session` null if email confirmation is on) |
| `POST /api/auth/admin/register` | no | same with role `admin`; `403` when `ADMIN_SIGNUP_ENABLED=false` |
| `POST /api/auth/login` | no | `200 { user, session: { accessToken, refreshToken, expiresAt } }`; `401` wrong credentials |
| `POST /api/auth/admin/login` | no | same, `403` if the account is not `admin` |
| `POST /api/auth/refresh` | no | `{ refreshToken }` → new session (used by the axios interceptor) |
| `POST /api/auth/logout` | yes (any role) | Supabase `auth.admin.signOut(accessToken, 'local')`: revokes the refresh token(s) of this session only → `204`; Supabase failure → `502 Logout failed` (logged). The access token (JWT) is stateless and stays valid until it expires (~1 h); the refresh token is what gets revoked |
| `GET /api/auth/me` | yes | current profile |
| `GET /api/events` | yes | list with filters `?search=&category=&status=` |
| `GET /api/events/:id` | yes | event with nested `products` (`json_build_object` / `json_agg`) |
| `POST /api/events` | admin | create event, optional `imageUrl` (must be the caller's own upload: `isUserImageUrl`, else `400 "Invalid image URL"`) (+ broadcast `event-created`) |
| `PATCH /api/events/:id` | admin | partial edit of `title`, `description`, `venueName`, `address`, `startsAt`, `endsAt` (nullable), `latitude`, `longitude`, `capacity`, `imageUrl` (nullable; unchanged current URL always accepted, a new one must be the caller's upload); other keys → `400 Field "<key>" cannot be updated`; a blank `address` resets it to the venue name (the `venueName` of the same body, otherwise the stored `venue_name`, set in the same UPDATE), `null`/non-string address → `400 Address is invalid`; `409 Capacity cannot be lower than the current occupancy (<n> people)` (+ broadcast `event-updated`) |
| `PATCH /api/events/:id/occupancy` | admin | change `occupied` (+ activity row, broadcast `event-updated`, `activity-created`) |
| `GET /api/events/stats` | admin | `peopleNow`, `activeEvents`, `eventsToday`, `capacityPercent` in one CTE query |
| `GET /api/events/activity` | admin | recent feed across all events, `?limit` 1..100 (default 20) |
| `GET /api/events/:id/activity` | admin | activity feed of one event, `?limit` (default 50) |

Both activity read endpoints return `{ id, eventId, message, createdAt, event: { id, title, status } }`: `event` is nested by Postgres in the same query (`json_build_object` over `JOIN public.events`, `ACTIVITY_WITH_EVENT_COLUMNS` in `event.repository.ts`, type `EventActivityWithEvent`). The field was added without removing or renaming any existing one. `status` is the stored status (`open`, `almost-full`...); the admin maps it with `toAdminStatus`. The `PATCH /api/events/:id/occupancy` response keeps `activity` without `event` (unchanged on purpose).
| `GET /api/products`, `GET /api/products/:id` | yes | tickets (with nested `event`) |
| `GET /api/payments` | yes | **current user's** payments with nested `product` and `event` |
| `GET /api/saved-events`, `POST /api/saved-events/:eventId`, `DELETE /api/saved-events/:eventId` | yes | saved events of the current user |
| `POST /api/uploads/images` | admin | multipart field `image` (JPEG/PNG/WebP, max 5 MB) → Supabase Storage bucket `IMAGES_BUCKET` (default `event-images`, public, created at startup if missing) at `<userId>/<uuid>.<ext>` → `201 { url }`; `400 "Image is required"`, `413 "Image must be at most 5 MB"`, `415 "Only JPEG, PNG or WebP images are allowed"`, `502 "Image upload failed"` |

`GET /api/clients` (list of every user) disappears from the client app: it leaks every profile. Keep it admin-only if needed.

## Realtime contract (Supabase Broadcast)

| Channel | Event | Payload | Emitted by | Handled by |
|---------|-------|---------|------------|------------|
| `events` | `event-created` | `{ id }` | `createEventService` | user `EventsProvider`, admin `EventsProvider` |
| `events` | `event-updated` | `{ id }` | `updateOccupancyService`, `updateEventService` | user `EventsProvider`, admin `EventsProvider` |
| `events` | `activity-created` | `{ id, eventId }` | `updateOccupancyService` | admin `ActivityProvider` |
| `events` | `event-deleted` | `{ id }` | `deleteEventService` | both `EventsProvider`s |

One public channel `events` (`EVENTS_CHANNEL`, names in `REALTIME_EVENTS`, `server/src/lib/realtime.ts`). `event-deleted` is not emitted yet (no delete endpoint). `broadcast()` uses `channel.httpSend` (REST, no websocket), is fire-and-forget (never throws, logs failures), is skipped when Supabase is not configured, and is only called after the write succeeded (after COMMIT for occupancy).

Messages are **signals only**: the channel is public (anyone with the publishable key can send to it), so payloads carry ids and nothing from a payload is displayed. Receivers validate the ids (UUID) and re-read the data from the API (`GET /api/events/:id`, the activity feeds); a 404 removes the event from the list, so a forged signal shows nothing.

**Connection loss** (`channel error: transport failure` / `socket closed`): realtime-js reconnects and rejoins on its own (backoff ~1–2 s). Broadcast does not replay messages, so signals sent while disconnected are lost. `client/lib/admin/realtime.ts` therefore (1) logs one `console.warn` per outage, (2) logs a `console.error` if the channel is still down after 30 s, and (3) on the first `SUBSCRIBED` after a failure logs `console.info` and calls every subscriber's `onResync`: admin `EventsProvider` re-reads the list, stats and open event, `ActivityProvider` the recent feed and the open event's feed (in the background, merged by id, no loading state). One shared channel per page (no duplicate joins when navigating between admin pages).

## Target client providers

| Provider | Where mounted | Owns |
|----------|---------------|------|
| `ToastProvider` | `components/Providers.tsx` | `showToast(message, type)` |
| `AxiosProvider` | `components/Providers.tsx` | exposes the single `api` instance from `lib/axios.ts` |
| `AuthProvider` (the "UserProvider") | `components/Providers.tsx` | session, `user`, `login`, `register`, `logout`, `ready` |
| `EventsProvider` (user) | user layout/pages | events list, filters, selected event, realtime |
| `SavedEventsProvider` | user layout/pages | saved ids, `toggleSaved(eventId)` |
| `PaymentsProvider` | profile page | current user's payments |
| `admin/EventsProvider`, `admin/ActivityProvider`, `admin/ProfileProvider` | `contexts/admin/AdminState.tsx` | admin data from the API + realtime |

`DataProvider` is legacy: it mixes products, payments, events and saved events. Split it into the feature providers above as each feature is connected.

## Known gaps (rubric checklist)

**Ownership:** this developer works on the **admin app + server** only (see `CLAUDE.md` → "Scope"). Gaps marked *(user app)* belong to a teammate: do not fix them, just keep the server API compatible with them.

Admin-side gaps (this developer):

- [x] `contexts/admin/EventsProvider`, `ActivityProvider`, `ProfileProvider` read `lib/events.ts` / hard-coded data → `EventsProvider` loads `/api/events`, `/api/events/stats`, `/api/events/:id`; `ActivityProvider` loads `/api/events/activity`, `/api/events/:id/activity` (both through `adminApi`, admin-only, mapped in `lib/admin/mappers.ts`); `ProfileProvider` derives from the `/api/auth/me` user. No admin file imports `@/lib/events` or `@/types/models`.
- [x] Admin login/register do nothing (`router.push`) and inputs are uncontrolled (`AuthForm`, `AuthInput`) → `AdminAuthProvider` + controlled inputs + validation + loading.
- [x] Admin routes are not protected → `components/admin/PrivateRoute` with `role="admin"` in `app/admin/(panel)/layout.tsx` and the other admin pages.
- [x] Admin logout is a `<Link href="/login">` → async `AdminAuthProvider.logout()`: `POST /api/auth/logout` best-effort (an `/api/auth/` route, so the `adminApi` interceptor never refreshes/retries its 401; a failure is `console.error`ed), then ALWAYS clears the stored session and redirects to `/admin/login`. `loggingOut` flag; `LogoutButton` shows "Logging out..." and is disabled meanwhile. If the access token had already expired, the call answers 401 and that refresh token is not revoked (it is still removed locally). The session-expired flow is unchanged. Session-scoped admin providers (`EventsProvider` → `ActivityProvider` → `ProfileProvider` → `EventDraftProvider`) are re-created per user in `AdminState` (`key="<id>:<role>"`), which is what drops the previous user's data and drafts.
- [x] No admin axios instance with token + refresh interceptor → `lib/admin/axios.ts`; no `lib/admin/config.ts`.
- [x] No toasts in admin → `contexts/admin/ToastProvider.tsx`.
- [x] `/admin/events/new` form does nothing → `EventForm mode="create"` (was `NewEventForm`; controlled, `validateEventDraft` field errors, `creating` flag) + `EventsProvider.createEvent` (`POST /api/events`); draft kept in `EventDraftProvider` while the location is picked on `/admin/map` (`LocationPicker`, Leaflet; "Use map center" button + Enter/Space on the focused map for keyboard users). Image upload done: `hooks/admin/useImageUpload` (client pre-check with `lib/admin/images.ts`, `POST /api/uploads/images` as `FormData` field `image`, `uploading` + error toast) → controlled `ImageUpload` preview → `EventDraft.imageUrl` (survives the map round trip) → `imageUrl` in `POST /api/events`. Remote (Supabase) images render with `next/image` `unoptimized` (`isRemoteImage`), so `next.config.js` needs no `remotePatterns`.
- [x] Events cannot be edited → `PATCH /api/events/:id` + admin `/admin/events/[id]/edit` (cards on `/admin/events` link there via `EventCard href`). `EventForm mode="edit"` loads the event with `loadEvent`, fills its draft once with `toEventDraft` (Bogota date/times; `endDate` = Bogota date of `endsAt`, '' when no end), validates with `validateEventDraft(draft, { minCapacity: event.attendees })`, sends `toUpdateEventInput` (title, description, venueName, startsAt, endsAt, latitude, longitude, capacity, imageUrl; never address/categories/status/occupied), "Save Changes"/"Saving..." while `saving`; success or Cancel drops that draft. `EventDraftProvider` keeps one draft per key (`new`, `edit:<uuid>`; `useEventDraft(key)` → `draft`, `hasDraft`, setters, `initDraft` (only when missing), `resetDraft`); editing never touches the create draft, all drafts reset on user change. End date (`EventDraft.endDate`, "End Date (optional)" input next to "End Time (optional)"): `endTime` '' → `endsAt: null`; `endDate` set → `endsAt = <endDate>T<endTime>-05:00` (events longer than 24 h survive an edit); `endDate` '' → same night, or the next day when `endTime <= time` (create default, unchanged). `validateEventDraft`: `endDate` must be a valid date, needs `endTime` ("Select the end time"), cannot be before `date` ("End date cannot be before the start date") and the end must be after the start ("End must be after the start", on `endTime`); without `endDate`, `endTime === time` is rejected. `/admin/map?draft=<key>` (`useSearchParams` inside `<Suspense>`; unknown key → `new`) writes the location into that draft and returns to its form (`lib/admin/drafts.ts`). Status, occupancy (own endpoint) and categories are not edited here; no delete.
- [x] Live control has no occupancy actions and no realtime → `PATCH /api/events/:id/occupancy` + Broadcast `event-updated` / `activity-created` handled in admin providers. Server endpoint done (transactional `updateOccupancyRepository`, 404/409). Admin UI done: `OccupancyControl` (−5/−1/+1/+5) on `/admin/live/[id]` via `hooks/admin/useOccupancy` (`EventsProvider.updateOccupancy` + `ActivityProvider.addActivity`). Server broadcasts and admin subscriptions done (see Realtime below).
- [x] Activity feed without its event → read queries nest `event` with `json_build_object`; the overview's `ActivityList showEvent` shows the event name (link to `/admin/live/<id>`) and its `StatusBadge`.
- [x] Admin stats computed on the client → `GET /api/events/stats` (CTE, `getEventStatsRepository`, Bogota day), called by the admin `EventsProvider` (`stats`, shown by `StatsGrid`).

All gaps (server ones are this developer's too):

- [x] Server: events → tables `events` + `event_activity` in `initDb` (seeded from the old client catalog in `src/db/seed.ts`), async `features/events/event.repository.ts`, read routes `GET /api/events`, `/stats`, `/activity`, `/:id`, `/:id/activity`.
- [ ] Server: `data.mock.ts` still used by products, clients and payments → Supabase tables + async repositories (`pg` pool). `GET /api/events/:id` has no nested `products` until the `products` table exists.
- [x] Server: `POST /api/events` (admin, `parseCreateEventBody`, 201) and `PATCH /api/events/:id/occupancy` (admin, `{ delta }` -50..50, one transaction with `SELECT ... FOR UPDATE` + activity row, 200 `{ event, activity }`, 404/409).
- [x] Server: events follow-ups: realtime broadcasts (`event-created`, `event-updated`, `activity-created` on channel `events`), image uploads (`POST /api/uploads/images`, `lib/storage.ts` with `ensureImagesBucket` + `isUserImageUrl`, `middlewares/uploadMiddleware.ts`), `imageUrl` on `POST /api/events`.
- [x] Server: `src/db/db.ts` (pool + `initDb`, table `profiles`), `src/lib/supabase.ts`, `src/shared/types.ts`, `npm run db:init`.
- [x] Server: `src/lib/realtime.ts` (`broadcast`, `EVENTS_CHANNEL`, `REALTIME_EVENTS`).
- [x] Server: `authMiddleware` + `requireRole('admin')` exist. The mock routes (`/api/products`, `/api/clients`, `/api/payments`) stay public because the teammate's user app still uses them.
- [x] Server: `app.ts` only listens when run directly (`require.main === module`), so tests and Vercel import it without opening a port. Kept as one entry file on purpose (the Vercel deploy uses `src/app.ts`), instead of the `index.ts` split in `env-config.md`.
- [x] Server: `typecheck`, `test` scripts; `dev` is `tsx watch src/app.ts`.
- [x] Server: ESLint 9 flat config (`eslint.config.mjs`: `@eslint/js` + `typescript-eslint` recommended on `src/**` and `test/**`, `_`-prefixed unused vars/args allowed) and `npm run lint` (`eslint .`), clean.
- [x] Server: `.env.example` missing (`PORT`, `CLIENT_ORIGIN`, `DB_*`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `IMAGES_BUCKET`).
- [ ] Client: `.env.example` missing (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); `lib/config.ts` missing (env read inside `AxiosProvider`).
- [ ] Client: fake login with `DEMO_PASSWORDS`; no token, no refresh interceptor, no session-expired handling.
- [x] Client: admin login/register/logout do nothing; admin routes are not protected → done in the admin app (see "Admin-side gaps" above: `AdminAuthProvider`, `PrivateRoute`, `POST /api/auth/logout`).
- [ ] Client: `Guard` → rename/alias to `PrivateRoute` (with `role` prop for admin).
- [ ] Client: no toasts; errors only as inline text.
- [ ] Client: user components are flat files (`components/StatusBadge.tsx`) → move to `components/<Name>/<Name>.tsx`; shared `AuthForm`/`EmptyState` should serve both apps.
- [ ] Client: pages contain logic (filtering in `home/page.tsx`, payment filtering in `profile/page.tsx`) → move to providers.
- [ ] Client: `AuthForm.onSubmit` and form fields are uncontrolled → controlled inputs with validation.
- [x] Client: ESLint config → `client/eslint.config.mjs` (ESLint 9 flat config: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`; ignores `.next/`, `out/`, `build/`, `node_modules/`, `next-env.d.ts`) and `npm run lint:admin` (admin folders only), clean. `npx eslint .` still reports user-app findings *(user app)*: 7 errors / 16 warnings in 13 files (`@next/next/no-img-element` 12, `react-hooks/exhaustive-deps` 4, `react/no-unescaped-entities` 2, `react-hooks/set-state-in-effect` 2, `react-hooks/refs` 1, `@typescript-eslint/no-require-imports` 1 in `next.config.js`, `@typescript-eslint/no-empty-object-type` 1 in `types/models.ts`).
- [ ] Client: no `typecheck`/`test` scripts.
- [x] Realtime (admin): `client/lib/admin/{config,supabase,realtime}.ts` (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, lazy browser-only client, `subscribeToEventsChannel` = one shared ref-counted `events` channel that fans out to every subscriber and calls `removeChannel` when the last one leaves). Signals only: admin `EventsProvider` re-fetches `GET /api/events/:id` on `event-created` / `event-updated` (latest request per id wins; also refreshes the open detail view; 404 removes the event) + debounced stats refresh; `ActivityProvider` re-fetches the recent feed and, if open, that event's feed on `activity-created` (debounced, merged by id). Skipped silently when not configured.
- [ ] Realtime (user app): no user-app provider subscribes yet.
