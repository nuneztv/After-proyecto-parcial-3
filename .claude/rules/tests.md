---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.test.mts"
  - "server/test/**/*.ts"
  - "client/test/**/*.{ts,tsx}"
---

# Tests

**Server** (`server/test/<feature>/*.test.ts`): `node:test` + `node:assert/strict`, run with `tsx` (`npm test`).
- Service tests replace the repository (and `lib/realtime`, `lib/supabase`) with `mock.module` and assert behavior: success value, `Boom` status codes, ownership, broadcast only on success.
- Route tests use `supertest` against the exported `app` (`app.ts` does not listen; `index.ts` does).
- Repository tests need a real Supabase database; name them `*.integration.test.ts` and skip when `DB_HOST` is unset.

**Client** (`client/test/**`): Vitest + Testing Library, jsdom.
- Test components through what the user sees and does (`getByRole`, `userEvent.click`).
- Wrap components in the real provider; mock `@/lib/axios`, `@/lib/supabase` and `next/navigation` at the boundary.
- Hooks: `renderHook`. Assert cleanup (channel removed, watcher cleared on unmount).
- Cover the axios refresh interceptor (401 → refresh → retry; refresh fails → session cleared).

**Both**
- Names describe behavior: `test('updateOccupancyService throws 409 when occupancy exceeds capacity', ...)`.
- Each feature covers: happy path, validation errors, not found, unauthorized/forbidden/ownership when applicable.
- Expected values are written by hand. One main assertion per test. No `any`, no `@ts-ignore`.
- If a test fails because of a real bug, do not weaken the test: report the bug.

Templates: `.claude/docs/server/testing.md`, `.claude/docs/client/testing.md`.
