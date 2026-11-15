import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { UpdateEventDTO } from '../../src/features/events/event.types';
import {
  checkedInEvent,
  checkInActivity,
  editedEvent,
  EVENT_ID,
} from '../helpers/eventFixtures';

// Unit test of the transaction flow only: pool.connect() returns a fake client that records
// every statement, so no database is touched. SQL correctness is left to integration tests.

interface QueryResult {
  rows: unknown[];
}

type Responder = (sql: string) => QueryResult | Promise<QueryResult>;

const statements: string[] = [];
// Full SQL and params of every statement, to assert what the dynamic UPDATE sends
const queries: { sql: string; params: unknown[] | undefined }[] = [];
const release = mock.fn((_error?: Error): void => undefined);
let respond: Responder = () => ({ rows: [] });

const fakeClient = {
  query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
    statements.push(sql.trim().split(/\s+/)[0]);
    queries.push({ sql, params });
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
  queries.length = 0;
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

interface StoredEventRow {
  occupied: number;
  capacity: number;
  starts_at: Date | string;
  ends_at: Date | string | null;
  image_url: string | null;
}

// pg returns timestamptz columns as Date objects
const storedRow: StoredEventRow = {
  occupied: 342,
  capacity: 400,
  starts_at: new Date('2026-11-14T23:00:00.000Z'),
  ends_at: new Date('2026-11-15T07:00:00.000Z'),
  image_url: '/images/events/rooftop-sessions.jpg',
};

const withStoredRow = (row: StoredEventRow | undefined): Responder => (sql) => {
  if (sql.startsWith('SELECT')) {
    return { rows: row ? [row] : [] };
  }

  if (sql.startsWith('UPDATE')) {
    return { rows: [editedEvent] };
  }

  return { rows: [] };
};

const allowAll = (_imageUrl: string): boolean => true;
const allowNone = (_imageUrl: string): boolean => false;

const updateQuery = (): { sql: string; params: unknown[] | undefined } | undefined =>
  queries.find((query) => query.sql.startsWith('UPDATE'));

// Only the SET clause, without the WHERE/RETURNING tail
const setClauseOf = (sql: string): string =>
  sql.slice(sql.indexOf('SET ') + 4, sql.indexOf(' WHERE'));

const updateEvent = (
  dto: UpdateEventDTO,
  isNewImageAllowed: (imageUrl: string) => boolean = allowAll,
) => repository.updateEventRepository(EVENT_ID, dto, isNewImageAllowed);

test('updateEventRepository commits and returns ok with the updated event', async () => {
  respond = withStoredRow(storedRow);

  const result = await updateEvent({ title: 'Rooftop Sessions XL', capacity: 450 });

  assert.deepEqual(result, { kind: 'ok', event: editedEvent });
});

test('updateEventRepository runs BEGIN, SELECT, UPDATE, COMMIT on success', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ title: 'Rooftop Sessions XL' });

  assert.deepEqual(statements, ['BEGIN', 'SELECT', 'UPDATE', 'COMMIT']);
});

test('updateEventRepository locks the row with SELECT ... FOR UPDATE by id', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ title: 'Rooftop Sessions XL' });

  const select = queries.find((query) => query.sql.startsWith('SELECT'));
  assert.deepEqual([/FOR UPDATE\s*$/.test(select?.sql ?? ''), select?.params], [true, [EVENT_ID]]);
});

test('updateEventRepository sets only the provided columns with matching params', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ title: 'Rooftop Sessions XL', capacity: 450 });

  const update = updateQuery();
  assert.deepEqual(
    [setClauseOf(update?.sql ?? ''), update?.params],
    ['title = $2, capacity = $3', [EVENT_ID, 'Rooftop Sessions XL', 450]],
  );
});

test('updateEventRepository orders SET columns by the whitelist, not by the DTO key order', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({
    imageUrl: null,
    capacity: 450,
    longitude: -76.5,
    latitude: 3.45,
    endsAt: '2026-11-15T08:00:00.000Z',
    startsAt: '2026-11-14T22:00:00.000Z',
    address: 'Calle 1',
    venueName: 'Skyline',
    description: 'New',
    title: 'Rooftop',
  });

  const update = updateQuery();
  assert.deepEqual(
    [setClauseOf(update?.sql ?? ''), update?.params],
    [
      'title = $2, description = $3, venue_name = $4, address = $5, starts_at = $6, ' +
        'ends_at = $7, latitude = $8, longitude = $9, capacity = $10, image_url = $11',
      [
        EVENT_ID,
        'Rooftop',
        'New',
        'Skyline',
        'Calle 1',
        '2026-11-14T22:00:00.000Z',
        '2026-11-15T08:00:00.000Z',
        3.45,
        -76.5,
        450,
        null,
      ],
    ],
  );
});

test('updateEventRepository targets the event id as $1 and returns the event columns', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ title: 'Rooftop Sessions XL' });

  assert.match(updateQuery()?.sql ?? '', /WHERE e\.id = \$1 RETURNING/);
});

test('updateEventRepository clears the end with endsAt: null (ends_at = NULL param)', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ endsAt: null });

  const update = updateQuery();
  assert.deepEqual(
    [setClauseOf(update?.sql ?? ''), update?.params],
    ['ends_at = $2', [EVENT_ID, null]],
  );
});

test('updateEventRepository resets a null address to the stored venue_name without a param', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ address: null });

  const update = updateQuery();
  assert.deepEqual(
    [setClauseOf(update?.sql ?? ''), update?.params],
    ['address = venue_name', [EVENT_ID]],
  );
});

test('updateEventRepository keeps $n contiguous around a null address reset', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ title: 'Rooftop', address: null, capacity: 450 });

  const update = updateQuery();
  assert.deepEqual(
    [setClauseOf(update?.sql ?? ''), update?.params],
    ['title = $2, address = venue_name, capacity = $3', [EVENT_ID, 'Rooftop', 450]],
  );
});

test('updateEventRepository commits a null address reset', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ address: null });

  assert.deepEqual(statements, ['BEGIN', 'SELECT', 'UPDATE', 'COMMIT']);
});

test('updateEventRepository rolls back and returns not-found for a missing event', async () => {
  respond = withStoredRow(undefined);

  const result = await updateEvent({ title: 'Rooftop Sessions XL' });

  assert.deepEqual([result, statements], [{ kind: 'not-found' }, ['BEGIN', 'SELECT', 'ROLLBACK']]);
});

test('updateEventRepository rolls back and returns capacity-below-occupancy with the occupancy', async () => {
  respond = withStoredRow(storedRow);

  const result = await updateEvent({ capacity: 341 });

  assert.deepEqual(
    [result, statements],
    [{ kind: 'capacity-below-occupancy', occupied: 342 }, ['BEGIN', 'SELECT', 'ROLLBACK']],
  );
});

test('updateEventRepository accepts a capacity equal to the current occupancy', async () => {
  respond = withStoredRow(storedRow);

  const result = await updateEvent({ capacity: 342 });

  assert.equal(result.kind, 'ok');
});

test('updateEventRepository checks the stored capacity when the DTO does not change it', async () => {
  // Already over capacity (e.g. data fixed by hand): an unrelated edit still reports it
  respond = withStoredRow({ ...storedRow, occupied: 401 });

  const result = await updateEvent({ title: 'Rooftop Sessions XL' });

  assert.deepEqual(result, { kind: 'capacity-below-occupancy', occupied: 401 });
});

test('updateEventRepository rolls back ends-before-start when a new start reaches the stored end', async () => {
  respond = withStoredRow(storedRow);

  const result = await updateEvent({ startsAt: '2026-11-15T07:00:00.000Z' });

  assert.deepEqual(
    [result, statements],
    [{ kind: 'ends-before-start' }, ['BEGIN', 'SELECT', 'ROLLBACK']],
  );
});

test('updateEventRepository returns ends-before-start when a new end is before the stored start', async () => {
  respond = withStoredRow(storedRow);

  const result = await updateEvent({ endsAt: '2026-11-14T18:00:00-05:00' });

  assert.deepEqual(result, { kind: 'ends-before-start' });
});

test('updateEventRepository accepts a later start when the same request clears the end', async () => {
  respond = withStoredRow(storedRow);

  const result = await updateEvent({ startsAt: '2026-11-16T23:00:00.000Z', endsAt: null });

  assert.equal(result.kind, 'ok');
});

test('updateEventRepository accepts any start when the stored event has no end', async () => {
  respond = withStoredRow({ ...storedRow, ends_at: null });

  const result = await updateEvent({ startsAt: '2026-12-01T23:00:00.000Z' });

  assert.equal(result.kind, 'ok');
});

test('updateEventRepository keeps the stored image without asking the predicate', async () => {
  respond = withStoredRow(storedRow);
  const predicate = mock.fn(allowNone);

  const result = await updateEvent({ imageUrl: '/images/events/rooftop-sessions.jpg' }, predicate);

  assert.deepEqual([result.kind, predicate.mock.callCount()], ['ok', 0]);
});

test('updateEventRepository removes the image (null) without asking the predicate', async () => {
  respond = withStoredRow(storedRow);
  const predicate = mock.fn(allowNone);

  const result = await updateEvent({ imageUrl: null }, predicate);

  assert.deepEqual([result.kind, predicate.mock.callCount()], ['ok', 0]);
});

test('updateEventRepository asks the predicate with the new image URL', async () => {
  respond = withStoredRow(storedRow);
  const predicate = mock.fn(allowAll);

  await updateEvent({ imageUrl: 'https://cdn.example.com/new.png' }, predicate);

  assert.deepEqual(predicate.mock.calls[0].arguments, ['https://cdn.example.com/new.png']);
});

test('updateEventRepository updates to a new image the predicate allows', async () => {
  respond = withStoredRow(storedRow);

  await updateEvent({ imageUrl: 'https://cdn.example.com/new.png' }, allowAll);

  assert.deepEqual(updateQuery()?.params, [EVENT_ID, 'https://cdn.example.com/new.png']);
});

test('updateEventRepository rolls back image-not-allowed for a new image the predicate rejects', async () => {
  respond = withStoredRow(storedRow);

  const result = await updateEvent({ imageUrl: 'https://evil.example.com/x.png' }, allowNone);

  assert.deepEqual(
    [result, statements],
    [{ kind: 'image-not-allowed' }, ['BEGIN', 'SELECT', 'ROLLBACK']],
  );
});

test('updateEventRepository rolls back and rethrows when the UPDATE fails', async () => {
  const failure = new Error('connection lost');
  respond = (sql) => {
    if (sql.startsWith('UPDATE')) {
      throw failure;
    }

    return withStoredRow(storedRow)(sql);
  };

  await assert.rejects(() => updateEvent({ title: 'Rooftop Sessions XL' }), failure);
  assert.deepEqual(statements, ['BEGIN', 'SELECT', 'UPDATE', 'ROLLBACK']);
});

test('updateEventRepository rejects an empty DTO and rolls back without sending an UPDATE', async () => {
  respond = withStoredRow(storedRow);

  await assert.rejects(() => updateEvent({}));
  assert.deepEqual(statements, ['BEGIN', 'SELECT', 'ROLLBACK']);
});

for (const [label, row, dto] of [
  ['success', storedRow, { title: 'Rooftop Sessions XL' }],
  ['not-found', undefined, { title: 'Rooftop Sessions XL' }],
  ['capacity-below-occupancy', storedRow, { capacity: 1 }],
  ['ends-before-start', storedRow, { startsAt: '2026-11-16T00:00:00.000Z' }],
  ['image-not-allowed', storedRow, { imageUrl: 'https://evil.example.com/x.png' }],
] as const) {
  test(`updateEventRepository releases the client once without an error on ${label}`, async () => {
    respond = withStoredRow(row);

    await updateEvent(dto, allowNone);

    assert.deepEqual(
      [release.mock.callCount(), release.mock.calls[0].arguments],
      [1, [undefined]],
    );
  });
}

test('updateEventRepository hands the failed connection back to the pool for disposal', async () => {
  const failure = new Error('update failed');
  respond = (sql) => {
    if (sql.startsWith('UPDATE')) {
      throw failure;
    }

    return withStoredRow(storedRow)(sql);
  };

  await assert.rejects(() => updateEvent({ title: 'Rooftop Sessions XL' }));
  assert.deepEqual(release.mock.calls[0].arguments, [failure]);
});

test('updateEventRepository rethrows the original error when ROLLBACK also fails', async () => {
  const failure = new Error('update failed');
  respond = (sql) => {
    if (sql.startsWith('UPDATE')) {
      throw failure;
    }

    if (sql.startsWith('ROLLBACK')) {
      throw new Error('rollback failed');
    }

    return withStoredRow(storedRow)(sql);
  };
  const consoleError = mock.method(console, 'error', () => undefined);

  await assert.rejects(() => updateEvent({ title: 'Rooftop Sessions XL' }), failure);
  consoleError.mock.restore();
});

test('updateEventRepository releases the client when ROLLBACK also fails', async () => {
  respond = (sql) => {
    if (sql.startsWith('UPDATE') || sql.startsWith('ROLLBACK')) {
      throw new Error('connection lost');
    }

    return withStoredRow(storedRow)(sql);
  };
  const consoleError = mock.method(console, 'error', () => undefined);

  await assert.rejects(() => updateEvent({ title: 'Rooftop Sessions XL' }));
  consoleError.mock.restore();
  assert.equal(release.mock.callCount(), 1);
});
