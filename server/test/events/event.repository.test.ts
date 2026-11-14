import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { checkedInEvent, checkInActivity, EVENT_ID } from '../helpers/eventFixtures';

// Unit test of the transaction flow only: pool.connect() returns a fake client that records
// every statement, so no database is touched. SQL correctness is left to integration tests.

interface QueryResult {
  rows: unknown[];
}

type Responder = (sql: string) => QueryResult | Promise<QueryResult>;

const statements: string[] = [];
const release = mock.fn((_error?: Error): void => undefined);
let respond: Responder = () => ({ rows: [] });

const fakeClient = {
  query: async (sql: string, _params?: unknown[]): Promise<QueryResult> => {
    statements.push(sql.trim().split(/\s+/)[0]);
    return respond(sql);
  },
  release,
};

mock.module('../../src/db/db', {
  namedExports: {
    pool: { connect: async () => fakeClient, query: mock.fn() },
    initDb: mock.fn(),
  },
});

let repository: typeof import('../../src/features/events/event.repository');

before(async () => {
  repository = await import('../../src/features/events/event.repository');
});

beforeEach(() => {
  statements.length = 0;
  release.mock.resetCalls();
});

const withRow = (row: { occupied: number; capacity: number } | undefined): Responder => (sql) => {
  if (sql.startsWith('SELECT')) {
    return { rows: row ? [row] : [] };
  }

  if (sql.startsWith('UPDATE')) {
    return { rows: [checkedInEvent] };
  }

  if (sql.startsWith('INSERT')) {
    return { rows: [checkInActivity] };
  }

  return { rows: [] };
};

test('updateOccupancyRepository commits and returns ok inside the capacity', async () => {
  respond = withRow({ occupied: 342, capacity: 400 });

  const result = await repository.updateOccupancyRepository(EVENT_ID, 1);

  assert.deepEqual(result, { kind: 'ok', event: checkedInEvent, activity: checkInActivity });
});

test('updateOccupancyRepository runs BEGIN, SELECT, UPDATE, INSERT, COMMIT on success', async () => {
  respond = withRow({ occupied: 342, capacity: 400 });

  await repository.updateOccupancyRepository(EVENT_ID, 1);

  assert.deepEqual(statements, ['BEGIN', 'SELECT', 'UPDATE', 'INSERT', 'COMMIT']);
});

test('updateOccupancyRepository rolls back and returns not-found for a missing event', async () => {
  respond = withRow(undefined);

  const result = await repository.updateOccupancyRepository(EVENT_ID, 1);

  assert.deepEqual([result, statements], [{ kind: 'not-found' }, ['BEGIN', 'SELECT', 'ROLLBACK']]);
});

test('updateOccupancyRepository rolls back and returns out-of-range above capacity', async () => {
  respond = withRow({ occupied: 400, capacity: 400 });

  const result = await repository.updateOccupancyRepository(EVENT_ID, 1);

  assert.deepEqual([result, statements], [{ kind: 'out-of-range' }, ['BEGIN', 'SELECT', 'ROLLBACK']]);
});

test('updateOccupancyRepository rolls back and returns out-of-range below zero', async () => {
  respond = withRow({ occupied: 0, capacity: 400 });

  const result = await repository.updateOccupancyRepository(EVENT_ID, -1);

  assert.deepEqual(result, { kind: 'out-of-range' });
});

test('updateOccupancyRepository accepts a delta that fills the venue exactly', async () => {
  respond = withRow({ occupied: 350, capacity: 400 });

  const result = await repository.updateOccupancyRepository(EVENT_ID, 50);

  assert.equal(result.kind, 'ok');
});

test('updateOccupancyRepository rolls back and rethrows when a query fails', async () => {
  const failure = new Error('connection lost');
  respond = (sql) => {
    if (sql.startsWith('UPDATE')) {
      throw failure;
    }

    return withRow({ occupied: 342, capacity: 400 })(sql);
  };

  await assert.rejects(() => repository.updateOccupancyRepository(EVENT_ID, 1), failure);
  assert.deepEqual(statements, ['BEGIN', 'SELECT', 'UPDATE', 'ROLLBACK']);
});

for (const [label, row] of [
  ['success', { occupied: 342, capacity: 400 }],
  ['not-found', undefined],
  ['out-of-range', { occupied: 400, capacity: 400 }],
] as const) {
  test(`updateOccupancyRepository releases the client on ${label}`, async () => {
    respond = withRow(row);

    await repository.updateOccupancyRepository(EVENT_ID, 1);

    assert.equal(release.mock.callCount(), 1);
  });
}

test('updateOccupancyRepository rethrows the original error when ROLLBACK also fails', async () => {
  const failure = new Error('update failed');
  respond = (sql) => {
    if (sql.startsWith('UPDATE')) {
      throw failure;
    }

    if (sql.startsWith('ROLLBACK')) {
      throw new Error('rollback failed');
    }

    return withRow({ occupied: 342, capacity: 400 })(sql);
  };
  const consoleError = mock.method(console, 'error', () => undefined);

  await assert.rejects(() => repository.updateOccupancyRepository(EVENT_ID, 1), failure);
  consoleError.mock.restore();
});

test('updateOccupancyRepository hands the failed connection back to the pool for disposal', async () => {
  const failure = new Error('update failed');
  respond = (sql) => {
    if (sql.startsWith('UPDATE')) {
      throw failure;
    }

    return withRow({ occupied: 342, capacity: 400 })(sql);
  };

  await assert.rejects(() => repository.updateOccupancyRepository(EVENT_ID, 1));
  assert.deepEqual(release.mock.calls[0].arguments, [failure]);
});

test('updateOccupancyRepository releases the client when a query fails', async () => {
  respond = () => {
    throw new Error('connection lost');
  };

  await assert.rejects(() => repository.updateOccupancyRepository(EVENT_ID, 1));
  assert.equal(release.mock.callCount(), 1);
});
