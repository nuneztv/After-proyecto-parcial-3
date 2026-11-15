# Config, env vars and bootstrap

## `src/config.ts`: the only reader of `process.env`

The file already exists (`PORT`, `NODE_ENV`, `CLIENT_ORIGIN`); extend it, never read `process.env` elsewhere.

```ts
import dotenv from 'dotenv';

dotenv.config();

export const PORT = Number(process.env.PORT) || 4000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3001';

// Supabase Postgres (pooler)
export const DB_HOST = process.env.DB_HOST || '';
export const DB_PORT = Number(process.env.DB_PORT) || 6543;
export const DB_NAME = process.env.DB_NAME || 'postgres';
export const DB_USER = process.env.DB_USER || '';
export const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Supabase API (secret key: server only)
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

export const IMAGES_BUCKET = process.env.IMAGES_BUCKET || 'event-images';
```

Required secrets without a safe default fail fast in the module that needs them (`if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')` in `lib/supabase.ts`).

## Third-party clients (`src/lib/<name>.ts`)

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from '../config';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
}

// Shared by every request: never keep a user session in memory
export const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

## `server/.env.example` (committed, placeholders only)

```
PORT=4000
NODE_ENV=development
# Comma-separated list of allowed origins
CLIENT_ORIGIN=http://localhost:3001

# Supabase Postgres (Project Settings > Database > Connection pooling)
DB_HOST=aws-0-<region>.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.<project-ref>
DB_PASSWORD=

# Supabase API (Project Settings > API). Secret key: never ship it to the client
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=

# Storage
IMAGES_BUCKET=event-images
```

Every new variable is added to `config.ts` **and** `.env.example`. Never read or edit `.env`.

## `app.ts` and `index.ts`

Today `app.ts` builds the app **and** listens. Split it so tests import the app without opening a port:

```ts
// app.ts
import cors from 'cors';
import express from 'express';
import { CLIENT_ORIGIN } from './config';
import { errorsMiddleware } from './middlewares/errorsMiddleware';
import { router as eventsRouter } from './features/events/event.router';

const app = express();

app.use(express.json());
app.use(cors({ origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN.split(',') }));

app.get('/', (_req, res) => {
  res.json({ name: 'After API' });
});

app.use('/api/events', eventsRouter);
app.use(errorsMiddleware);

export default app;
```

```ts
// index.ts
import app from './app';
import { PORT } from './config';
import { initDb } from './db/db';

app.listen(PORT, async () => {
  await initDb();
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

## `package.json` scripts (server)

```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "typecheck": "tsc --noEmit -p tsconfig.test.json",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "test": "node --import tsx --experimental-test-module-mocks --test \"test/**/*.test.ts\""
}
```

Dependencies to add when connecting Supabase: `pg`, `@supabase/supabase-js` (+ `@types/pg`, `tsx` as dev). Keep `tsconfig.json` with `rootDir: "src"` and `include: ["src"]`.

## ESLint (server)

Flat config `server/eslint.config.mjs` with `@eslint/js`, `typescript-eslint` recommended and `@stylistic`: `indent 2`, `quotes single`, `semi always`, `comma-dangle always-multiline`, `arrow-parens always`, `no-console warn`, unused vars error with `argsIgnorePattern: '^_'`; ignore `dist/` and `node_modules/`. The existing server code uses double quotes: run `npm run lint:fix` once after adding the config.
