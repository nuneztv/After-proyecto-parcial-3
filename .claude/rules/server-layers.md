---
paths:
  - "server/src/features/**/*.ts"
---

# Server layers

Each feature lives in `server/src/features/<feature>/` (plural folder) with five files named after the entity in singular: `<entity>.router.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.types.ts` (e.g. `features/events/event.service.ts`). Dependencies go one way: router → controller → service → repository.

- **Router:** only maps HTTP verb + path to middlewares and a controller. No logic. `export const router = Router();`, mounted in `src/app.ts` under `/api/<feature>`. Every async handler/middleware is wrapped with `asyncHandler` (Express 4 does not forward rejected promises).
- **Controller:** reads `req`, validates input (throws `Boom.badRequest`), calls **one** service, sends the response with the right status (`201` create, `200` read, `204` delete). No SQL, no business rules.
- **Service:** business rules, ownership checks, orchestration across repositories, Supabase Auth/Storage calls, realtime broadcasts (`lib/realtime`). Throws `Boom` errors. Never touches `req`/`res`.
- **Repository:** the only layer that talks to the database, through the shared `pool`. `async`, parameterized SQL only (`$1`, `$2`). Maps snake_case columns with `AS "camelCase"`. Nested objects with `json_build_object`; aggregates with CTEs.
- **Types:** domain interfaces and `Create*DTO` interfaces. Types used by several features go in `src/shared/types.ts`.
- Name functions `<verb><Entity><Layer>`: `createEventController`, `createEventService`, `createEventRepository`. Legacy `findAllProducts`-style names get the `Repository` suffix when touched.
- A service may call another feature's *service*, never its repository.
- `data.mock.ts` files are legacy: when a feature is connected to Supabase, delete its mock and seed the data in `initDb` instead.

Patterns and templates: `.claude/docs/server/layers.md`, `router-controller.md`, `service.md`, `repository.md`.
