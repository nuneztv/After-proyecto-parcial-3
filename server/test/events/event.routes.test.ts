import assert from 'node:assert/strict';
import Boom from '@hapi/boom';
import { before, beforeEach, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';
import { EVENT_ID, MISSING_EVENT_ID, rooftopActivity, rooftopEvent, seedStats } from '../helpers/eventFixtures';

const getUser = asyncMock();
const getProfileRoleService = asyncMock();
const getEventsService = asyncMock();
const getEventByIdService = asyncMock();
const getEventStatsService = asyncMock();
const getEventActivityService = asyncMock();
const getRecentActivityService = asyncMock();

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
