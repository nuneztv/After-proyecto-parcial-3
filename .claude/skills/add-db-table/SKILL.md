---
name: add-db-table
description: Adds a Supabase Postgres table to server/src/db/db.ts (idempotent initDb, optional seed) and the repository functions that use it. Use when an After feature needs persistent data.
argument-hint: "<table and columns>"
---

# Add a database table

Argument: the table and its columns (for example `event_activity(event_id, message)`).

1. Read `.claude/rules/server-db.md`, `.claude/docs/server/db-init.md` and the target schema in `.claude/docs/project/domain.md` (use those column names if the table is listed there).
2. Read `.claude/docs/server/repository.md` for the repository template (`json_build_object`, CTE).
3. Add the types to `<entity>.types.ts` (entity + `Create*DTO`).
4. Append `CREATE TABLE IF NOT EXISTS public.<table>` to `initDb()` after the tables it references, plus indexes and an idempotent seed if demo data is needed. Never drop or alter existing tables there; for changes to existing tables, write the migration SQL, show it to the user and ask them to run it in the Supabase SQL editor.
5. Add repository functions: create (`RETURNING`), list, get by id (and by owner when user-scoped), delete (returns `boolean`).
6. Add repository integration tests (skipped when `DB_HOST` is unset) per `.claude/docs/server/testing.md`.
7. Run `npm run typecheck` and `npm run lint` in `server/`.
