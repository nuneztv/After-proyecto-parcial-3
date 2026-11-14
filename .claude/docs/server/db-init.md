# Database init (Supabase Postgres)

`src/db/db.ts` exports the pool and an idempotent `initDb()` run once at startup from `index.ts`. The full target schema is in `.claude/docs/project/domain.md`.

```ts
import { Pool } from 'pg';
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from '../config';

export const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  // Supabase requires TLS
  ssl: { rejectUnauthorized: false },
});

export const initDb = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      -- ...rest of the columns from domain.md
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
  `);
};
```

## Conventions

- Create parents before children: `profiles` → `events` → `products` → `payments`, `saved_events`, `event_activity`.
- `ON DELETE CASCADE` when the child has no meaning without the parent (`products` of an event, `saved_events`).
- User-scoped tables: `user_id UUID NOT NULL REFERENCES public.profiles(id)`, plus an index.
- Enums as `TEXT` with a `CHECK` constraint (`status IN ('live','open','almost-full','closed')`).
- Optional columns are nullable, mapped to `string | null` in types.
- Seeds (demo data moved out of `data.mock.ts`) use `INSERT ... ON CONFLICT (id) DO NOTHING` with fixed UUIDs so they are idempotent.
- `initDb()` only ever *adds*. Changing an existing table needs a written migration SQL that the user reviews and runs in the Supabase SQL editor; never `DROP` here.
- RLS: the server connects as the `postgres` role (bypasses RLS). If a table must be readable from the browser, enable RLS and add policies explicitly; by default the browser never queries tables directly.

## Connection notes

- Supabase dashboard → Project Settings → Database → Connection string. Use the **pooler** host (`aws-0-<region>.pooler.supabase.com`), user `postgres.<project-ref>`, port `6543` (transaction mode) or `5432` (session mode).
- One pool per process; never create pools inside request handlers.
- `auth.users` is managed by Supabase Auth; we only reference it from `profiles`.

## Bootstrap

In `index.ts`:

```ts
import app from './app';
import { PORT } from './config';
import { initDb } from './db/db';

app.listen(PORT, async () => {
  await initDb();
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

Vercel (serverless) does not run `index.ts`: export `app` as default for the serverless entry and run `initDb` once manually (or via a script) instead of on every cold start.
