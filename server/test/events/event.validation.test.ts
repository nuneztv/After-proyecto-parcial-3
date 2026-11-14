import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseActivityLimit,
  parseEventFilters,
  parseEventId,
} from '../../src/features/events/event.validation';
import { statusOf } from '../helpers/supabaseMocks';
import { EVENT_ID } from '../helpers/eventFixtures';

const messageOf = (error: unknown): string | undefined => (error as { message?: string }).message;

test('parseEventId returns a valid UUID unchanged', () => {
  assert.equal(parseEventId(EVENT_ID), EVENT_ID);
});

test('parseEventId throws 400 for a legacy mock id', () => {
  assert.throws(() => parseEventId('evt-1'), (error) => statusOf(error) === 400);
});

test('parseEventId throws "Invalid event id" when the id is missing', () => {
  assert.throws(() => parseEventId(undefined), (error) => messageOf(error) === 'Invalid event id');
});

test('parseEventFilters defaults to an empty search and all categories and statuses', () => {
  assert.deepEqual(parseEventFilters({}), { search: '', category: 'all', status: 'all' });
});

test('parseEventFilters trims the search text', () => {
  assert.equal(parseEventFilters({ search: '  jazz  ' }).search, 'jazz');
});

test('parseEventFilters accepts a known category and status', () => {
  assert.deepEqual(parseEventFilters({ category: 'music', status: 'almost-full' }), {
    search: '',
    category: 'music',
    status: 'almost-full',
  });
});

test('parseEventFilters throws "Invalid category" for an unknown category', () => {
  assert.throws(
    () => parseEventFilters({ category: 'techno' }),
    (error) => statusOf(error) === 400 && messageOf(error) === 'Invalid category',
  );
});

test('parseEventFilters throws "Invalid status" for the admin-only status upcoming', () => {
  assert.throws(
    () => parseEventFilters({ status: 'upcoming' }),
    (error) => statusOf(error) === 400 && messageOf(error) === 'Invalid status',
  );
});

test('parseEventFilters throws 400 when status arrives as an array', () => {
  assert.throws(
    () => parseEventFilters({ status: ['live', 'open'] }),
    (error) => statusOf(error) === 400 && messageOf(error) === 'Invalid status',
  );
});

test('parseEventFilters throws 400 for a search longer than 100 characters', () => {
  assert.throws(
    () => parseEventFilters({ search: 'a'.repeat(101) }),
    (error) =>
      statusOf(error) === 400 && messageOf(error) === 'Search must be at most 100 characters',
  );
});

test('parseActivityLimit returns the fallback when the limit is missing', () => {
  assert.equal(parseActivityLimit(undefined, 20), 20);
});

test('parseActivityLimit parses a numeric string', () => {
  assert.equal(parseActivityLimit('5', 20), 5);
});

for (const value of ['0', '101', 'abc']) {
  test(`parseActivityLimit throws 400 for "${value}"`, () => {
    assert.throws(
      () => parseActivityLimit(value, 20),
      (error) =>
        statusOf(error) === 400 &&
        messageOf(error) === 'Limit must be an integer between 1 and 100',
    );
  });
}
