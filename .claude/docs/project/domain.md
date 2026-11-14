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
| Create event | form does nothing | `client/app/admin/events/new/page.tsx` |

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
| `GET /api/auth/me` | yes | current profile |
| `GET /api/events` | yes | list with filters `?search=&category=&status=` |
| `GET /api/events/:id` | yes | event with nested `products` (`json_build_object` / `json_agg`) |
| `POST /api/events` | admin | create event (+ broadcast `event-created`) |
| `PATCH /api/events/:id/occupancy` | admin | change `occupied` (+ activity row, broadcast `event-updated`, `activity-created`) |
| `GET /api/events/stats` | admin | `peopleNow`, `activeEvents`, `eventsToday`, `capacityPercent` in one CTE query |
| `GET /api/events/:id/activity` | admin | activity feed |
| `GET /api/products`, `GET /api/products/:id` | yes | tickets (with nested `event`) |
| `GET /api/payments` | yes | **current user's** payments with nested `product` and `event` |
| `GET /api/saved-events`, `POST /api/saved-events/:eventId`, `DELETE /api/saved-events/:eventId` | yes | saved events of the current user |
| `POST /api/uploads/images` | admin | event image → Supabase Storage |

`GET /api/clients` (list of every user) disappears from the client app: it leaks every profile. Keep it admin-only if needed.

## Realtime contract (Supabase Broadcast)

| Channel | Event | Payload | Emitted by | Handled by |
|---------|-------|---------|------------|------------|
| `events` | `event-created` | `Event` | `createEventService` | user `EventsProvider`, admin `EventsProvider` |
| `events` | `event-updated` | `Event` | `updateOccupancyService` | user `EventsProvider`, admin `EventsProvider` |
| `events` | `event-deleted` | `{ id }` | `deleteEventService` | both `EventsProvider`s |
| `event:<id>` | `activity-created` | `Activity` | `updateOccupancyService` | admin `ActivityProvider` |

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
- [x] Admin logout is a `<Link href="/login">` → `logout()` that clears the session.
- [x] No admin axios instance with token + refresh interceptor → `lib/admin/axios.ts`; no `lib/admin/config.ts`.
- [x] No toasts in admin → `contexts/admin/ToastProvider.tsx`.
- [ ] `/admin/events/new` form does nothing → `createEvent` with validation, `creating` flag, image upload.
- [ ] Live control has no occupancy actions and no realtime → `PATCH /api/events/:id/occupancy` + Broadcast `event-updated` / `activity-created` handled in admin providers.
- [x] Admin stats computed on the client → `GET /api/events/stats` (CTE, `getEventStatsRepository`, Bogota day), called by the admin `EventsProvider` (`stats`, shown by `StatsGrid`).

All gaps (server ones are this developer's too):

- [x] Server: events → tables `events` + `event_activity` in `initDb` (seeded from the old client catalog in `src/db/seed.ts`), async `features/events/event.repository.ts`, read routes `GET /api/events`, `/stats`, `/activity`, `/:id`, `/:id/activity`.
- [ ] Server: `data.mock.ts` still used by products, clients and payments → Supabase tables + async repositories (`pg` pool). `GET /api/events/:id` has no nested `products` until the `products` table exists.
- [ ] Server: events follow-ups: `POST /api/events`, `PATCH /api/events/:id/occupancy`, realtime broadcasts, image uploads.
- [x] Server: `src/db/db.ts` (pool + `initDb`, table `profiles`), `src/lib/supabase.ts`, `src/shared/types.ts`, `npm run db:init`.
- [ ] Server: `src/lib/realtime.ts` does not exist.
- [x] Server: `authMiddleware` + `requireRole('admin')` exist. The mock routes (`/api/products`, `/api/clients`, `/api/payments`) stay public because the teammate's user app still uses them.
- [x] Server: `app.ts` only listens when run directly (`require.main === module`), so tests and Vercel import it without opening a port. Kept as one entry file on purpose (the Vercel deploy uses `src/app.ts`), instead of the `index.ts` split in `env-config.md`.
- [x] Server: `typecheck`, `test` scripts; `dev` is `tsx watch src/app.ts`.
- [ ] Server: no ESLint config / `lint` script.
- [x] Server: `.env.example` missing (`PORT`, `CLIENT_ORIGIN`, `DB_*`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `IMAGES_BUCKET`).
- [ ] Client: `.env.example` missing (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); `lib/config.ts` missing (env read inside `AxiosProvider`).
- [ ] Client: fake login with `DEMO_PASSWORDS`; no token, no refresh interceptor, no session-expired handling.
- [ ] Client: admin login/register/logout do nothing; admin routes are not protected.
- [ ] Client: `Guard` → rename/alias to `PrivateRoute` (with `role` prop for admin).
- [ ] Client: no toasts; errors only as inline text.
- [ ] Client: user components are flat files (`components/StatusBadge.tsx`) → move to `components/<Name>/<Name>.tsx`; shared `AuthForm`/`EmptyState` should serve both apps.
- [ ] Client: pages contain logic (filtering in `home/page.tsx`, payment filtering in `profile/page.tsx`) → move to providers.
- [ ] Client: `AuthForm.onSubmit` and form fields are uncontrolled → controlled inputs with validation.
- [ ] Client: no `typecheck`/`test` scripts and no ESLint config file (`npm run lint` fails until `eslint.config.mjs` exists).
- [ ] Realtime: nothing emitted or subscribed yet (see contract above).
