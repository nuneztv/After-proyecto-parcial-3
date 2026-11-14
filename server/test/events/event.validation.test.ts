import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseActivityLimit,
  parseCreateEventBody,
  parseEventFilters,
  parseEventId,
  parseOccupancyDelta,
} from '../../src/features/events/event.validation';
import { statusOf } from '../helpers/supabaseMocks';
import { createEventBody, EVENT_ID } from '../helpers/eventFixtures';

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

const minimalBody = {
  title: 'Salsa Night',
  venueName: 'La Topa Tolondra',
  startsAt: '2026-11-20T21:00:00-05:00',
  latitude: 3.4495,
  longitude: -76.5385,
  capacity: 250,
};

const throwsBadRequest = (fn: () => unknown, message: string): void => {
  assert.throws(fn, (error) => statusOf(error) === 400 && messageOf(error) === message);
};

test('parseCreateEventBody returns the DTO for a complete body', () => {
  assert.deepEqual(parseCreateEventBody(createEventBody), {
    title: 'Salsa Night',
    description: 'Live salsa band until late.',
    venueName: 'La Topa Tolondra',
    address: 'Calle 5 #13-27, Cali',
    startsAt: '2026-11-20T21:00:00-05:00',
    endsAt: '2026-11-21T03:00:00-05:00',
    latitude: 3.4495,
    longitude: -76.5385,
    capacity: 250,
    categories: ['music', 'party'],
    imageUrl: null,
  });
});

test('parseCreateEventBody fills the defaults for a minimal body', () => {
  assert.deepEqual(parseCreateEventBody(minimalBody), {
    title: 'Salsa Night',
    description: '',
    venueName: 'La Topa Tolondra',
    address: 'La Topa Tolondra',
    startsAt: '2026-11-20T21:00:00-05:00',
    endsAt: null,
    latitude: 3.4495,
    longitude: -76.5385,
    capacity: 250,
    categories: [],
    imageUrl: null,
  });
});

test('parseCreateEventBody trims the title', () => {
  const dto = parseCreateEventBody({ ...minimalBody, title: '  Salsa Night  ' });

  assert.equal(dto.title, 'Salsa Night');
});

test('parseCreateEventBody uses the venue name when the address is blank', () => {
  const dto = parseCreateEventBody({ ...minimalBody, address: '   ' });

  assert.equal(dto.address, 'La Topa Tolondra');
});

test('parseCreateEventBody accepts a null endsAt', () => {
  assert.equal(parseCreateEventBody({ ...minimalBody, endsAt: null }).endsAt, null);
});

test('parseCreateEventBody removes duplicated categories', () => {
  const dto = parseCreateEventBody({ ...minimalBody, categories: ['music', 'bar', 'music'] });

  assert.deepEqual(dto.categories, ['music', 'bar']);
});

test('parseCreateEventBody accepts a UTC (Z) start date', () => {
  const dto = parseCreateEventBody({ ...minimalBody, startsAt: '2026-11-21T02:00:00.000Z' });

  assert.equal(dto.startsAt, '2026-11-21T02:00:00.000Z');
});

for (const body of [null, 'title', [minimalBody], 42]) {
  test(`parseCreateEventBody throws "Invalid body" for ${JSON.stringify(body)}`, () => {
    throwsBadRequest(() => parseCreateEventBody(body), 'Invalid body');
  });
}

for (const title of [undefined, '', '   ', 12]) {
  test(`parseCreateEventBody throws "Title is required" for title ${JSON.stringify(title)}`, () => {
    throwsBadRequest(() => parseCreateEventBody({ ...minimalBody, title }), 'Title is required');
  });
}

test('parseCreateEventBody throws when the title is longer than 80 characters', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, title: 'a'.repeat(81) }),
    'Title must be at most 80 characters',
  );
});

test('parseCreateEventBody accepts a title of exactly 80 characters', () => {
  const dto = parseCreateEventBody({ ...minimalBody, title: 'a'.repeat(80) });

  assert.equal(dto.title.length, 80);
});

test('parseCreateEventBody throws "Venue is required" when the venue is missing', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, venueName: undefined }),
    'Venue is required',
  );
});

test('parseCreateEventBody throws when the venue is longer than 80 characters', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, venueName: 'v'.repeat(81) }),
    'Venue must be at most 80 characters',
  );
});

test('parseCreateEventBody throws when the description is longer than 500 characters', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, description: 'd'.repeat(501) }),
    'Description must be at most 500 characters',
  );
});

test('parseCreateEventBody throws "Description is invalid" for a non-string description', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, description: 5 }),
    'Description is invalid',
  );
});

test('parseCreateEventBody throws when the address is longer than 160 characters', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, address: 'x'.repeat(161) }),
    'Address must be at most 160 characters',
  );
});

for (const startsAt of [
  undefined,
  '2026-11-20T21:00:00',
  '2026-11-20',
  'tonight',
  '2026-13-45T21:00:00Z',
  '2026-02-30T21:00:00-05:00',
  '2026-11-20T24:00:00-05:00',
  '2026-11-20T21:60:00-05:00',
]) {
  test(`parseCreateEventBody throws "Start date is invalid" for ${JSON.stringify(startsAt)}`, () => {
    throwsBadRequest(
      () => parseCreateEventBody({ ...minimalBody, startsAt }),
      'Start date is invalid',
    );
  });
}

test('parseCreateEventBody throws "End date is invalid" for an end date without offset', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, endsAt: '2026-11-21T03:00:00' }),
    'End date is invalid',
  );
});

test('parseCreateEventBody throws "End must be after start" when endsAt equals startsAt', () => {
  // Same instant written in UTC: the comparison must be by time, not by string
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, endsAt: '2026-11-21T02:00:00Z' }),
    'End must be after start',
  );
});

test('parseCreateEventBody throws "End must be after start" when endsAt is before startsAt', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, endsAt: '2026-11-20T20:00:00-05:00' }),
    'End must be after start',
  );
});

for (const latitude of [90.5, -91, '3.45', undefined, Number.NaN]) {
  test(`parseCreateEventBody throws "Latitude is invalid" for ${String(latitude)}`, () => {
    throwsBadRequest(
      () => parseCreateEventBody({ ...minimalBody, latitude }),
      'Latitude is invalid',
    );
  });
}

for (const longitude of [180.1, -181, '-76.5']) {
  test(`parseCreateEventBody throws "Longitude is invalid" for ${String(longitude)}`, () => {
    throwsBadRequest(
      () => parseCreateEventBody({ ...minimalBody, longitude }),
      'Longitude is invalid',
    );
  });
}

for (const capacity of [0, 1.5, '10', 100001, undefined]) {
  test(`parseCreateEventBody throws the capacity message for ${JSON.stringify(capacity)}`, () => {
    throwsBadRequest(
      () => parseCreateEventBody({ ...minimalBody, capacity }),
      'Capacity must be an integer between 1 and 100000',
    );
  });
}

for (const categories of [['techno'], 'music', [3]]) {
  test(`parseCreateEventBody throws "Invalid category" for ${JSON.stringify(categories)}`, () => {
    throwsBadRequest(
      () => parseCreateEventBody({ ...minimalBody, categories }),
      'Invalid category',
    );
  });
}

for (const delta of [1, -1, 50, -50]) {
  test(`parseOccupancyDelta returns ${delta} for a valid delta`, () => {
    assert.equal(parseOccupancyDelta({ delta }), delta);
  });
}

for (const delta of [0, 51, -51, 1.5, '1', undefined, null]) {
  test(`parseOccupancyDelta throws 400 for delta ${JSON.stringify(delta)}`, () => {
    throwsBadRequest(
      () => parseOccupancyDelta({ delta }),
      'Delta must be a non-zero integer between -50 and 50',
    );
  });
}

test('parseOccupancyDelta throws 400 when the body is missing', () => {
  throwsBadRequest(
    () => parseOccupancyDelta(undefined),
    'Delta must be a non-zero integer between -50 and 50',
  );
});

// Shape only: ownership of the URL is checked by ensureOwnImageUrl (see event.routes.test.ts)
const IMAGE_URL =
  'https://test-project.supabase.co/storage/v1/object/public/event-images/user-1/f0000000-0000-4000-8000-000000000001.png';

test('parseCreateEventBody keeps a string imageUrl, trimmed', () => {
  const dto = parseCreateEventBody({ ...minimalBody, imageUrl: `  ${IMAGE_URL}  ` });

  assert.equal(dto.imageUrl, IMAGE_URL);
});

test('parseCreateEventBody returns a null imageUrl for a null imageUrl', () => {
  assert.equal(parseCreateEventBody({ ...minimalBody, imageUrl: null }).imageUrl, null);
});

test('parseCreateEventBody returns a null imageUrl for a blank imageUrl', () => {
  assert.equal(parseCreateEventBody({ ...minimalBody, imageUrl: '   ' }).imageUrl, null);
});

test('parseCreateEventBody throws 400 "Invalid image URL" for a non-string imageUrl', () => {
  throwsBadRequest(() => parseCreateEventBody({ ...minimalBody, imageUrl: 42 }), 'Invalid image URL');
});

test('parseCreateEventBody throws 400 "Invalid image URL" for an imageUrl over 500 characters', () => {
  throwsBadRequest(
    () => parseCreateEventBody({ ...minimalBody, imageUrl: `https://x.co/${'a'.repeat(490)}` }),
    'Invalid image URL',
  );
});
