# Server testing

Stack: `node:test` + `node:assert/strict`, run with `tsx`. `supertest` for HTTP.

## Setup (done by `test-writer` if missing)

```bash
cd server && npm install -D tsx supertest @types/supertest
```

Scripts: see `env-config.md` (`test` uses `--import tsx --experimental-test-module-mocks`, Node 22.3+). Typecheck tests with `tsconfig.test.json`; do NOT change `rootDir`/`include` in `tsconfig.json` (that moves the build output to `dist/src/...` and breaks `start`).

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": ".", "noEmit": true },
  "include": ["src/**/*", "test/**/*"]
}
```

Layout: `server/test/<feature>/<entity>.service.test.ts`, `<entity>.routes.test.ts`, `<entity>.repository.integration.test.ts`.

## Service test (repository mocked)

```ts
import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

const findEventByIdRepository = mock.fn();
const updateOccupancyRepository = mock.fn();
const createActivityRepository = mock.fn();
const broadcast = mock.fn(async () => undefined);

mock.module('../../src/features/events/event.repository', {
  namedExports: { findEventByIdRepository, updateOccupancyRepository, createActivityRepository },
});
mock.module('../../src/lib/realtime', { namedExports: { broadcast } });

const { updateOccupancyService } = await import('../../src/features/events/event.service');

beforeEach(() => {
  findEventByIdRepository.mock.resetCalls();
  broadcast.mock.resetCalls();
});

test('updateOccupancyService throws 404 when the event does not exist', async () => {
  findEventByIdRepository.mock.mockImplementation(async () => undefined);

  await assert.rejects(
    () => updateOccupancyService('e1', 10),
    (error: { output?: { statusCode: number } }) => error.output?.statusCode === 404,
  );
});

test('updateOccupancyService does not broadcast when occupancy exceeds capacity', async () => {
  findEventByIdRepository.mock.mockImplementation(async () => ({ id: 'e1', capacity: 100 }));

  await assert.rejects(() => updateOccupancyService('e1', 150));
  assert.equal(broadcast.mock.callCount(), 0);
});
```

Import the module under test **after** `mock.module` (dynamic `await import`). Mock everything the service imports that touches the network: repository, `lib/realtime`, `lib/supabase`.

CommonJS pitfall (this server has no `"type": "module"`): top-level `await` needs ESM. Name test files `*.test.mts`, or wrap the body in an async `before()` hook, or add `"type": "module"` only under `server/test/package.json`. Pick one and use it for every test.

## Route test (supertest)

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import app from '../../src/app';

test('GET /api/events returns 401 without a token', async () => {
  const res = await request(app).get('/api/events');

  assert.equal(res.status, 401);
});
```

Requires the `app.ts` / `index.ts` split. Validation and auth failures (400/401/403) fail before the repository, so they need no DB. Importing `app` imports `lib/supabase.ts`: mock it or set dummy `SUPABASE_URL`/`SUPABASE_SECRET_KEY` in the test command.

## Auth tests

- No header → 401. `Authorization: Basic x` → 401.
- Mock `lib/supabase` (`auth.getUser`) to return an error → 401; to return a user → handler runs.
- Client role on an admin route → 403.
- Other user's payment / saved event → 404.

## Repository integration tests

Need a real database; skip when it is not configured (`{ skip: !process.env.DB_HOST }`). Use a separate Supabase project or schema for tests; never run them against the demo data.

## What to cover per feature

Happy path, each validation error, not found, ownership/unauthorized/forbidden, side effects (broadcast on success only, Supabase failure → 502).
