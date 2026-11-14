---
paths:
  - "server/src/db/**/*.ts"
  - "server/src/lib/**/*.ts"
  - "server/src/config.ts"
  - "server/src/**/*.repository.ts"
---

# Server database and config (Supabase)

- One shared `pool` (`pg.Pool`, `ssl` enabled for Supabase) exported from `src/db/db.ts`. Repositories import it; nothing else creates pools.
- Schema lives in `initDb()` as idempotent statements (`CREATE TABLE IF NOT EXISTS public.<table>`, `CREATE INDEX IF NOT EXISTS`). Never drop or alter tables there; changes to existing tables are a migration SQL that the user reviews and runs.
- Primary keys `UUID PRIMARY KEY DEFAULT gen_random_uuid()` (`profiles.id` references `auth.users(id)`). Timestamps `TIMESTAMPTZ NOT NULL DEFAULT now()`. Foreign keys `ON DELETE CASCADE` when the child has no meaning without the parent. Enums as `TEXT` + `CHECK`.
- Every query is parameterized. Column lists that repeat go in a constant (`const EVENT_COLUMNS = '...'`). Cast numeric aggregates in SQL (`::int`).
- Nested JSON in responses is built in SQL with `json_build_object` / `json_agg`, not by extra queries per row. Several aggregates in one request → one CTE query.
- Delete repositories return `boolean` (`rowCount > 0`) so the service can raise `404`. Single-row reads return `T | undefined`.
- Environment access happens only in `src/config.ts` (dotenv + typed constants with defaults). Other modules import the constants, never `process.env`.
- Third-party clients are created once in `src/lib/<name>.ts` (`supabase.ts` with the secret key and `persistSession: false`).
- Adding or renaming an env var means updating `server/.env.example` too. Never read or edit `.env`.

Templates: `.claude/docs/server/db-init.md`, `.claude/docs/server/repository.md`, `.claude/docs/server/env-config.md`. Target schema: `.claude/docs/project/domain.md`.
