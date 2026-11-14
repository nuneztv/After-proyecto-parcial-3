# Server layers

## Folder map

```
server/src/
├── app.ts                    # builds the Express app (no listen) so tests can import it
├── index.ts                  # imports app, runs initDb/initStorage, listens on PORT (4000)
├── config.ts                 # the ONLY reader of process.env (dotenv + typed constants)
├── db/
│   └── db.ts                 # pg Pool (Supabase Postgres) + idempotent initDb()
├── lib/
│   ├── supabase.ts           # supabase client with the secret key (auth, storage, realtime)
│   └── realtime.ts           # broadcast(channel, event, payload), fire-and-forget
├── middlewares/
│   ├── errorsMiddleware.ts   # errorsMiddleware + asyncHandler
│   └── authMiddleware.ts     # authMiddleware, requireRole, getUserFromRequest
├── shared/
│   └── types.ts              # cross-feature types (AuthUser, Role, Paginated...)
└── features/<feature>/       # plural folder, singular files
    ├── <entity>.router.ts
    ├── <entity>.controller.ts
    ├── <entity>.service.ts
    ├── <entity>.repository.ts
    └── <entity>.types.ts
```

Current features: `products/` (`product.*`), `clients/` (`client.*`, becomes `profiles`), `payments/` (`payment.*`). Planned: `auth/`, `events/`, `saved-events/`, `uploads/` (see `.claude/docs/project/domain.md`).

## Request flow

```
HTTP → router → controller → service → repository → Supabase Postgres (pg pool)
                    │            │
         validates input    business rules, ownership,
         picks status       broadcasts (lib/realtime), Supabase Auth/Storage
```

| Layer | Knows about | Must not |
|-------|-------------|----------|
| Router | verbs, paths, middlewares, `asyncHandler`, controllers | contain logic |
| Controller | `req`, `res`, validation, status codes | run SQL or business rules |
| Service | repositories, other services, Boom, `lib/*` | touch `req`/`res` |
| Repository | `pool`, SQL, row mapping | throw HTTP errors, call services |

## Naming

`<verb><Entity><Layer>`: `getEventsController`, `createEventService`, `findEventByIdRepository`. Existing repositories use `findAllProducts` / `findProductById`; when you touch them, rename to the `...Repository` suffix and make them `async`. Types: `Event`, `CreateEventDTO`.

Routers export `export const router = Router();` (current style) and are mounted in `app.ts` with a prefix: `app.use('/api/events', eventsRouter)`. Inside the router paths are relative (`'/'`, `'/:id'`).

## Adding a feature, in order

1. `<entity>.types.ts`
2. table in `db/db.ts` (see `db-init.md`)
3. `<entity>.repository.ts` (see `repository.md`)
4. `<entity>.service.ts` (see `service.md`)
5. `<entity>.controller.ts` and `<entity>.router.ts` (see `router-controller.md`)
6. mount in `app.ts`
7. tests (see `testing.md`)

## Mounting

```ts
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/products', productsRouter);
app.use('/api/payments', paymentsRouter);
app.use(errorsMiddleware);   // always last
```

## Why this split (for the oral defense)

- Each layer has one reason to change: SQL changes touch only repositories, HTTP shape only controllers.
- Services can be unit-tested by mocking the repository module; routes by `supertest` against `app` without a DB.
- A feature folder is self-contained, so two people can work on `events/` and `payments/` without conflicts.
