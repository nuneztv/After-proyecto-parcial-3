import assert from 'node:assert/strict';
import Boom from '@hapi/boom';
import { before, beforeEach, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';
import { ownImageUrl, testConfig } from '../helpers/configMock';
import {
  checkedInEvent,
  checkInActivity,
  createEventBody,
  createdEvent,
  editedEvent,
  EVENT_ID,
  MISSING_EVENT_ID,
  rooftopActivity,
  rooftopEvent,
  seedStats,
} from '../helpers/eventFixtures';

const getUser = asyncMock();
const getProfileRoleService = asyncMock();
const getEventsService = asyncMock();
const getEventByIdService = asyncMock();
const getEventStatsService = asyncMock();
const getEventActivityService = asyncMock();
const getRecentActivityService = asyncMock();
const createEventService = asyncMock();
const updateOccupancyService = asyncMock();
const updateEventService = asyncMock();

// Fixed config: imageUrl ownership is checked against SUPABASE_URL, and the real one must not leak in
mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: { getSupabase: () => ({ auth: { getUser } }), createAuthClient: mock.fn() },
});
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { getProfileRoleService },
});
mock.module('../../src/features/events/event.service', {
  namedExports: {
    getEventsService,
    getEventByIdService,
    getEventStatsService,
    getEventActivityService,
    getRecentActivityService,
    createEventService,
    updateOccupancyService,
    updateEventService,
  },
});

let app: Express;

before(async () => {
  const mod = await import('../../src/app');
  // CommonJS interop: the default export can arrive wrapped once more
  app = ((mod.default as unknown as { default?: Express }).default ?? mod.default) as Express;

  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-1', email: 'lina@after.app' } },
    error: null,
  }));
});

beforeEach(() => {
  [
    getEventsService,
    getEventByIdService,
    getEventStatsService,
    getEventActivityService,
    getRecentActivityService,
    createEventService,
    updateOccupancyService,
    updateEventService,
  ].forEach((fn) => fn.mock.resetCalls());
});

const asRole = (role: 'admin' | 'client'): void => {
  getProfileRoleService.mock.mockImplementation(async () => role);
};

test('GET /api/events answers 401 without a token', async () => {
  const res = await request(app).get('/api/events');

  assert.equal(res.status, 401);
});

test('GET /api/events checks the token before validating the query', async () => {
  const res = await request(app).get('/api/events?category=techno');

  assert.equal(res.status, 401);
});

test('GET /api/events returns the list for a client token', async () => {
  asRole('client');
  getEventsService.mock.mockImplementation(async () => [rooftopEvent]);

  const res = await request(app).get('/api/events').set('Authorization', 'Bearer valid');

  assert.deepEqual(res.body, [rooftopEvent]);
});

test('GET /api/events passes the parsed filters to the service', async () => {
  asRole('client');
  getEventsService.mock.mockImplementation(async () => []);

  await request(app)
    .get('/api/events?search=%20jazz%20&category=music&status=live')
    .set('Authorization', 'Bearer valid');

  assert.deepEqual(getEventsService.mock.calls[0].arguments, [
    { search: 'jazz', category: 'music', status: 'live' },
  ]);
});

test('GET /api/events answers 400 "Invalid category" for an unknown category', async () => {
  asRole('client');

  const res = await request(app)
    .get('/api/events?category=techno')
    .set('Authorization', 'Bearer valid');

  assert.deepEqual([res.status, res.body.message], [400, 'Invalid category']);
});

test('GET /api/events answers 400 when status is repeated in the query', async () => {
  asRole('client');

  const res = await request(app)
    .get('/api/events?status=live&status=open')
    .set('Authorization', 'Bearer valid');

  assert.equal(res.status, 400);
});

test('GET /api/events/stats answers 403 for a client token', async () => {
  asRole('client');

  const res = await request(app).get('/api/events/stats').set('Authorization', 'Bearer valid');

  assert.equal(res.status, 403);
});

test('GET /api/events/stats returns the stats for an admin (not captured by /:id)', async () => {
  asRole('admin');
  getEventStatsService.mock.mockImplementation(async () => seedStats);

  const res = await request(app).get('/api/events/stats').set('Authorization', 'Bearer valid');

  assert.deepEqual(res.body, { peopleNow: 572, activeEvents: 2, eventsToday: 5, capacityPercent: 57 });
});

test('GET /api/events/activity returns the recent activity for an admin', async () => {
  asRole('admin');
  getRecentActivityService.mock.mockImplementation(async () => [rooftopActivity]);

  const res = await request(app).get('/api/events/activity').set('Authorization', 'Bearer valid');

  assert.deepEqual(res.body, [rooftopActivity]);
});

test('GET /api/events/activity nests the event of each row as { id, title, status }', async () => {
  asRole('admin');
  getRecentActivityService.mock.mockImplementation(async () => [rooftopActivity]);

  const res = await request(app).get('/api/events/activity').set('Authorization', 'Bearer valid');

  assert.deepEqual(res.body[0].event, {
    id: EVENT_ID,
    title: 'Rooftop Sessions',
    status: 'live',
  });
});

test('GET /api/events/activity keeps the existing fields next to the nested event', async () => {
  asRole('admin');
  getRecentActivityService.mock.mockImplementation(async () => [rooftopActivity]);

  const res = await request(app).get('/api/events/activity').set('Authorization', 'Bearer valid');

  assert.deepEqual(Object.keys(res.body[0]).sort(), [
    'createdAt',
    'event',
    'eventId',
    'id',
    'message',
  ]);
});

test('GET /api/events/:id/activity returns the rows with their nested event', async () => {
  asRole('admin');
  getEventActivityService.mock.mockImplementation(async () => [rooftopActivity]);

  const res = await request(app)
    .get(`/api/events/${EVENT_ID}/activity`)
    .set('Authorization', 'Bearer valid');

  assert.deepEqual(res.body, [rooftopActivity]);
});

test('GET /api/events/activity uses a default limit of 20', async () => {
  asRole('admin');
  getRecentActivityService.mock.mockImplementation(async () => []);

  await request(app).get('/api/events/activity').set('Authorization', 'Bearer valid');

  assert.deepEqual(getRecentActivityService.mock.calls[0].arguments, [20]);
});

test('GET /api/events/activity answers 403 for a client token', async () => {
  asRole('client');

  const res = await request(app).get('/api/events/activity').set('Authorization', 'Bearer valid');

  assert.equal(res.status, 403);
});

test('GET /api/events/:id answers 400 "Invalid event id" for a non-UUID id', async () => {
  asRole('client');

  const res = await request(app).get('/api/events/not-a-uuid').set('Authorization', 'Bearer valid');

  assert.deepEqual([res.status, res.body.message], [400, 'Invalid event id']);
});

test('GET /api/events/:id does not call the service for a non-UUID id', async () => {
  asRole('client');

  await request(app).get('/api/events/not-a-uuid').set('Authorization', 'Bearer valid');

  assert.equal(getEventByIdService.mock.callCount(), 0);
});

test('GET /api/events/:id returns the event for a client token', async () => {
  asRole('client');
  getEventByIdService.mock.mockImplementation(async () => rooftopEvent);

  const res = await request(app).get(`/api/events/${EVENT_ID}`).set('Authorization', 'Bearer valid');

  assert.deepEqual(res.body, rooftopEvent);
});

test('GET /api/events/:id answers 404 "Event not found" when the service throws notFound', async () => {
  asRole('client');
  getEventByIdService.mock.mockImplementation(async () => {
    throw Boom.notFound('Event not found');
  });

  const res = await request(app)
    .get(`/api/events/${MISSING_EVENT_ID}`)
    .set('Authorization', 'Bearer valid');

  assert.deepEqual([res.status, res.body.message], [404, 'Event not found']);
});

test('GET /api/events/:id/activity answers 403 for a client token', async () => {
  asRole('client');

  const res = await request(app)
    .get(`/api/events/${EVENT_ID}/activity`)
    .set('Authorization', 'Bearer valid');

  assert.equal(res.status, 403);
});

test('GET /api/events/:id/activity answers 400 for limit=0', async () => {
  asRole('admin');

  const res = await request(app)
    .get(`/api/events/${EVENT_ID}/activity?limit=0`)
    .set('Authorization', 'Bearer valid');

  assert.deepEqual(
    [res.status, res.body.message],
    [400, 'Limit must be an integer between 1 and 100'],
  );
});

test('GET /api/events/:id/activity passes the id and default limit 50 to the service', async () => {
  asRole('admin');
  getEventActivityService.mock.mockImplementation(async () => [rooftopActivity]);

  await request(app).get(`/api/events/${EVENT_ID}/activity`).set('Authorization', 'Bearer valid');

  assert.deepEqual(getEventActivityService.mock.calls[0].arguments, [EVENT_ID, 50]);
});

test('GET /api/events/:id/activity answers 404 when the event does not exist', async () => {
  asRole('admin');
  getEventActivityService.mock.mockImplementation(async () => {
    throw Boom.notFound('Event not found');
  });

  const res = await request(app)
    .get(`/api/events/${MISSING_EVENT_ID}/activity`)
    .set('Authorization', 'Bearer valid');

  assert.equal(res.status, 404);
});

test('POST /api/events answers 401 without a token', async () => {
  const res = await request(app).post('/api/events').send(createEventBody);

  assert.equal(res.status, 401);
});

test('POST /api/events answers 403 for a client token', async () => {
  asRole('client');

  const res = await request(app)
    .post('/api/events')
    .set('Authorization', 'Bearer valid')
    .send(createEventBody);

  assert.equal(res.status, 403);
});

test('POST /api/events does not call the service for a client token', async () => {
  asRole('client');

  await request(app).post('/api/events').set('Authorization', 'Bearer valid').send(createEventBody);

  assert.equal(createEventService.mock.callCount(), 0);
});

test('POST /api/events answers 400 "Title is required" for an admin with a body without title', async () => {
  asRole('admin');

  const res = await request(app)
    .post('/api/events')
    .set('Authorization', 'Bearer valid')
    .send({ ...createEventBody, title: '' });

  assert.deepEqual([res.status, res.body.message], [400, 'Title is required']);
});

test('POST /api/events does not call the service for an invalid body', async () => {
  asRole('admin');

  await request(app)
    .post('/api/events')
    .set('Authorization', 'Bearer valid')
    .send({ ...createEventBody, capacity: 0 });

  assert.equal(createEventService.mock.callCount(), 0);
});

test('POST /api/events answers 201 with the created event for an admin', async () => {
  asRole('admin');
  createEventService.mock.mockImplementation(async () => createdEvent);

  const res = await request(app)
    .post('/api/events')
    .set('Authorization', 'Bearer valid')
    .send(createEventBody);

  assert.deepEqual([res.status, res.body], [201, createdEvent]);
});

test('POST /api/events passes the parsed DTO and the token user id to the service', async () => {
  asRole('admin');
  createEventService.mock.mockImplementation(async () => createdEvent);

  await request(app)
    .post('/api/events')
    .set('Authorization', 'Bearer valid')
    .send({ ...createEventBody, title: '  Salsa Night ', categories: ['music', 'music'] });

  assert.deepEqual(createEventService.mock.calls[0].arguments, [
    {
      title: 'Salsa Night',
      description: 'Live salsa band until late.',
      venueName: 'La Topa Tolondra',
      address: 'Calle 5 #13-27, Cali',
      startsAt: '2026-11-20T21:00:00-05:00',
      endsAt: '2026-11-21T03:00:00-05:00',
      latitude: 3.4495,
      longitude: -76.5385,
      capacity: 250,
      categories: ['music'],
      imageUrl: null,
    },
    'user-1',
  ]);
});

test('PATCH /api/events/:id/occupancy answers 401 without a token', async () => {
  const res = await request(app).patch(`/api/events/${EVENT_ID}/occupancy`).send({ delta: 1 });

  assert.equal(res.status, 401);
});

test('PATCH /api/events/:id/occupancy answers 403 for a client token', async () => {
  asRole('client');

  const res = await request(app)
    .patch(`/api/events/${EVENT_ID}/occupancy`)
    .set('Authorization', 'Bearer valid')
    .send({ delta: 1 });

  assert.equal(res.status, 403);
});

test('PATCH /api/events/:id/occupancy answers 400 "Invalid event id" for a non-UUID id', async () => {
  asRole('admin');

  const res = await request(app)
    .patch('/api/events/not-a-uuid/occupancy')
    .set('Authorization', 'Bearer valid')
    .send({ delta: 1 });

  assert.deepEqual([res.status, res.body.message], [400, 'Invalid event id']);
});

test('PATCH /api/events/:id/occupancy answers 400 for a zero delta', async () => {
  asRole('admin');

  const res = await request(app)
    .patch(`/api/events/${EVENT_ID}/occupancy`)
    .set('Authorization', 'Bearer valid')
    .send({ delta: 0 });

  assert.deepEqual(
    [res.status, res.body.message],
    [400, 'Delta must be a non-zero integer between -50 and 50'],
  );
});

test('PATCH /api/events/:id/occupancy does not call the service for a string delta', async () => {
  asRole('admin');

  await request(app)
    .patch(`/api/events/${EVENT_ID}/occupancy`)
    .set('Authorization', 'Bearer valid')
    .send({ delta: '1' });

  assert.equal(updateOccupancyService.mock.callCount(), 0);
});

test('PATCH /api/events/:id/occupancy answers 404 when the event does not exist', async () => {
  asRole('admin');
  updateOccupancyService.mock.mockImplementation(async () => {
    throw Boom.notFound('Event not found');
  });

  const res = await request(app)
    .patch(`/api/events/${MISSING_EVENT_ID}/occupancy`)
    .set('Authorization', 'Bearer valid')
    .send({ delta: 1 });

  assert.deepEqual([res.status, res.body.message], [404, 'Event not found']);
});

test('PATCH /api/events/:id/occupancy answers 409 when occupancy would leave the range', async () => {
  asRole('admin');
  updateOccupancyService.mock.mockImplementation(async () => {
    throw Boom.conflict('Occupancy must stay between 0 and capacity');
  });

  const res = await request(app)
    .patch(`/api/events/${EVENT_ID}/occupancy`)
    .set('Authorization', 'Bearer valid')
    .send({ delta: 50 });

  assert.deepEqual(
    [res.status, res.body.message],
    [409, 'Occupancy must stay between 0 and capacity'],
  );
});

test('PATCH /api/events/:id/occupancy answers 200 with the event and activity', async () => {
  asRole('admin');
  updateOccupancyService.mock.mockImplementation(async () => ({
    event: checkedInEvent,
    activity: checkInActivity,
  }));

  const res = await request(app)
    .patch(`/api/events/${EVENT_ID}/occupancy`)
    .set('Authorization', 'Bearer valid')
    .send({ delta: 1 });

  assert.deepEqual([res.status, res.body], [200, { event: checkedInEvent, activity: checkInActivity }]);
});

test('PATCH /api/events/:id/occupancy passes the id and delta to the service', async () => {
  asRole('admin');
  updateOccupancyService.mock.mockImplementation(async () => ({
    event: checkedInEvent,
    activity: checkInActivity,
  }));

  await request(app)
    .patch(`/api/events/${EVENT_ID}/occupancy`)
    .set('Authorization', 'Bearer valid')
    .send({ delta: -3 });

  assert.deepEqual(updateOccupancyService.mock.calls[0].arguments, [EVENT_ID, -3]);
});

const postEvent = (body: Record<string, unknown>) =>
  request(app).post('/api/events').set('Authorization', 'Bearer valid').send(body);

const imageUrlPassed = (): unknown =>
  (createEventService.mock.calls[0].arguments[0] as { imageUrl?: unknown }).imageUrl;

test('POST /api/events answers 201 for an imageUrl in the admin\'s own image folder', async () => {
  asRole('admin');
  createEventService.mock.mockImplementation(async () => createdEvent);

  const res = await postEvent({ ...createEventBody, imageUrl: ownImageUrl('user-1') });

  assert.equal(res.status, 201);
});

test('POST /api/events passes the admin\'s own imageUrl to the service', async () => {
  asRole('admin');
  createEventService.mock.mockImplementation(async () => createdEvent);

  await postEvent({ ...createEventBody, imageUrl: ownImageUrl('user-1') });

  assert.equal(
    imageUrlPassed(),
    'https://test-project.supabase.co/storage/v1/object/public/event-images/user-1/f0000000-0000-4000-8000-000000000001.png',
  );
});

for (const [label, imageUrl] of [
  ['another user\'s image', ownImageUrl('user-2')],
  ['a foreign URL', 'https://evil.example.com/image.png'],
  ['garbage', 'not a url'],
  ['a URL over 500 characters', `${ownImageUrl('user-1')}${'a'.repeat(500)}`],
] as const) {
  test(`POST /api/events answers 400 "Invalid image URL" for ${label}`, async () => {
    asRole('admin');

    const res = await postEvent({ ...createEventBody, imageUrl });

    assert.deepEqual([res.status, res.body.message], [400, 'Invalid image URL']);
  });
}

test('POST /api/events does not call the service for another user\'s imageUrl', async () => {
  asRole('admin');

  await postEvent({ ...createEventBody, imageUrl: ownImageUrl('user-2') });

  assert.equal(createEventService.mock.callCount(), 0);
});

for (const [label, imageUrl] of [
  ['a missing', undefined],
  ['a null', null],
  ['a blank', '   '],
] as const) {
  test(`POST /api/events passes a null imageUrl to the service for ${label} imageUrl`, async () => {
    asRole('admin');
    createEventService.mock.mockImplementation(async () => createdEvent);

    await postEvent({ ...createEventBody, imageUrl });

    assert.equal(imageUrlPassed(), null);
  });
}

const patchEvent = (id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/events/${id}`).set('Authorization', 'Bearer valid').send(body);

test('PATCH /api/events/:id answers 401 without a token', async () => {
  const res = await request(app).patch(`/api/events/${EVENT_ID}`).send({ title: 'Rooftop' });

  assert.equal(res.status, 401);
});

test('PATCH /api/events/:id answers 403 for a client token', async () => {
  asRole('client');

  const res = await patchEvent(EVENT_ID, { title: 'Rooftop' });

  assert.equal(res.status, 403);
});

test('PATCH /api/events/:id does not call the service for a client token', async () => {
  asRole('client');

  await patchEvent(EVENT_ID, { title: 'Rooftop' });

  assert.equal(updateEventService.mock.callCount(), 0);
});

test('PATCH /api/events/:id answers 400 "Invalid event id" for a non-UUID id', async () => {
  asRole('admin');

  const res = await patchEvent('not-a-uuid', { title: 'Rooftop' });

  assert.deepEqual([res.status, res.body.message], [400, 'Invalid event id']);
});

test('PATCH /api/events/:id answers 400 for a field that cannot be updated', async () => {
  asRole('admin');

  const res = await patchEvent(EVENT_ID, { title: 'Rooftop', status: 'live' });

  assert.deepEqual([res.status, res.body.message], [400, 'Field "status" cannot be updated']);
});

test('PATCH /api/events/:id answers 400 "Nothing to update" for an empty body', async () => {
  asRole('admin');

  const res = await patchEvent(EVENT_ID, {});

  assert.deepEqual([res.status, res.body.message], [400, 'Nothing to update']);
});

test('PATCH /api/events/:id does not call the service for an invalid body', async () => {
  asRole('admin');

  await patchEvent(EVENT_ID, { capacity: 0 });

  assert.equal(updateEventService.mock.callCount(), 0);
});

test('PATCH /api/events/:id answers 404 when the event does not exist', async () => {
  asRole('admin');
  updateEventService.mock.mockImplementation(async () => {
    throw Boom.notFound('Event not found');
  });

  const res = await patchEvent(MISSING_EVENT_ID, { title: 'Rooftop' });

  assert.deepEqual([res.status, res.body.message], [404, 'Event not found']);
});

test('PATCH /api/events/:id answers 409 with the occupancy message', async () => {
  asRole('admin');
  updateEventService.mock.mockImplementation(async () => {
    throw Boom.conflict('Capacity cannot be lower than the current occupancy (342 people)');
  });

  const res = await patchEvent(EVENT_ID, { capacity: 100 });

  assert.deepEqual(
    [res.status, res.body.message],
    [409, 'Capacity cannot be lower than the current occupancy (342 people)'],
  );
});

test('PATCH /api/events/:id answers 200 with the updated event for an admin', async () => {
  asRole('admin');
  updateEventService.mock.mockImplementation(async () => editedEvent);

  const res = await patchEvent(EVENT_ID, { title: 'Rooftop Sessions XL', capacity: 450 });

  assert.deepEqual([res.status, res.body], [200, editedEvent]);
});

test('PATCH /api/events/:id passes the id, the parsed DTO and the token user id to the service', async () => {
  asRole('admin');
  updateEventService.mock.mockImplementation(async () => editedEvent);

  await patchEvent(EVENT_ID, { title: '  Rooftop Sessions XL ', capacity: 450, imageUrl: null });

  assert.deepEqual(updateEventService.mock.calls[0].arguments, [
    EVENT_ID,
    { title: 'Rooftop Sessions XL', capacity: 450, imageUrl: null },
    'user-1',
  ]);
});

test('PATCH /api/events/:id leaves the image ownership check to the service', async () => {
  // Keeping a stored image from another admin must reach the service, which compares it under lock
  asRole('admin');
  updateEventService.mock.mockImplementation(async () => editedEvent);

  const res = await patchEvent(EVENT_ID, { imageUrl: ownImageUrl('user-2') });

  assert.equal(res.status, 200);
});

test('PATCH /api/events/:id answers 200 for a blank address', async () => {
  asRole('admin');
  updateEventService.mock.mockImplementation(async () => editedEvent);

  const res = await patchEvent(EVENT_ID, { address: '   ' });

  assert.equal(res.status, 200);
});

test('PATCH /api/events/:id passes address: null to the service for a blank address', async () => {
  asRole('admin');
  updateEventService.mock.mockImplementation(async () => editedEvent);

  await patchEvent(EVENT_ID, { address: '' });

  assert.deepEqual(updateEventService.mock.calls[0].arguments, [
    EVENT_ID,
    { address: null },
    'user-1',
  ]);
});

test('PATCH /api/events/:id answers 400 "Address is invalid" for address: null', async () => {
  asRole('admin');

  const res = await patchEvent(EVENT_ID, { address: null });

  assert.deepEqual([res.status, res.body.message], [400, 'Address is invalid']);
});
