# API contract template (for `feature-planner`)

Fill this in the plan before any code is written. Server and client writers implement exactly this. Example below: saved events.

## Endpoints

| Method + path | Auth | Request body / params | Success | Errors |
|---------------|------|-----------------------|---------|--------|
| `GET /api/saved-events` | user | none | `200` `EventItem[]` (current user only) | `401` |
| `POST /api/saved-events/:eventId` | user | `:eventId` uuid | `201` `{ eventId }` | `400` invalid id, `401`, `404` event not found, `409` already saved |
| `DELETE /api/saved-events/:eventId` | user | `:eventId` uuid | `204` | `401`, `404` not saved |

Auth column values: `no`, `user` (`authMiddleware`), `admin` (`authMiddleware` + `requireRole('admin')`).

## Types (shared shape)

```ts
// server: features/saved-events/saved-event.types.ts   client: types/models.ts
interface SavedEvent { eventId: string; createdAt: string }
```

## Database

```
saved_events(user_id uuid fk -> profiles on delete cascade, event_id uuid fk -> events on delete cascade,
             created_at timestamptz default now(), primary key (user_id, event_id))
```

Queries that need nested objects: say which `json_build_object` / CTE they use.

## Realtime (if any)

| Channel | Event | Payload | Emitted by | Handled by |
|---------|-------|---------|------------|------------|
| none (user-scoped data is never broadcast) | | | | |

## Server files

- `features/saved-events/saved-event.{types,repository,service,controller,router}.ts`: list the functions per file.
- `db/db.ts`: table above. `app.ts`: `app.use('/api/saved-events', savedEventsRouter)`.

## Client files

- `types/models.ts`: new interfaces.
- `contexts/SavedEventsProvider.tsx`: `savedIds`, `savedEvents`, `loading`, `savingId`, `toggleSaved(eventId)`.
- `components/<Name>/<Name>.tsx`: list with props (callbacks receive ids).
- Pages: where the provider is mounted; what moves out of the page.
- Remove: legacy code this replaces (e.g. `getSavedIds`/`setSavedIds` in `lib/storage.ts`).

## Test cases

Server: service (happy path, not found, ownership), routes (400/401/403), side effects (broadcast on success only).
Client: provider loads + toggles with loading flag, error → toast, component callbacks receive ids, realtime dedupe.

## Assumptions

Anything decided without asking (role required, realtime or not, ownership, limits).
