import assert from 'node:assert/strict';
import Boom from '@hapi/boom';
import { before, beforeEach, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';
import { testConfig } from '../helpers/configMock';
import { EVENT_ID, MISSING_EVENT_ID, rooftopEvent } from '../helpers/eventFixtures';

const getUser = asyncMock();
const getProfileRoleService = asyncMock();
const getEventByIdService = asyncMock();
const findSavedEventsRepository = asyncMock();
const saveEventRepository = asyncMock();
const deleteSavedEventRepository = asyncMock();

mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: { getSupabase: () => ({ auth: { getUser } }), createAuthClient: mock.fn() },
});
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { getProfileRoleService },
});
// The real saved-events service runs; only the event lookup and the database are replaced
mock.module('../../src/features/events/event.service', {
  namedExports: {
    getEventByIdService,
    getEventsService: mock.fn(),
    getEventStatsService: mock.fn(),
    getEventActivityService: mock.fn(),
    getRecentActivityService: mock.fn(),
    createEventService: mock.fn(),
    updateOccupancyService: mock.fn(),
    updateEventService: mock.fn(),
  },
});
mock.module('../../src/features/saved-events/savedEvent.repository', {
  namedExports: { findSavedEventsRepository, saveEventRepository, deleteSavedEventRepository },
});

const USER_ID = 'user-1';
const savedRow = { eventId: EVENT_ID, savedAt: '2026-11-14T20:00:00.000Z', event: rooftopEvent };

let app: Express;

before(async () => {
  const mod = await import('../../src/app');
  // CommonJS interop: the default export can arrive wrapped once more
  app = ((mod.default as unknown as { default?: Express }).default ?? mod.default) as Express;

  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: USER_ID, email: 'lina@after.app' } },
    error: null,
  }));
  getProfileRoleService.mock.mockImplementation(async () => 'client');
});

beforeEach(() => {
  [getEventByIdService, findSavedEventsRepository, saveEventRepository, deleteSavedEventRepository].forEach(
    (fn) => fn.mock.resetCalls(),
  );
  getEventByIdService.mock.mockImplementation(async (id: unknown) => {
    if (id === MISSING_EVENT_ID) throw Boom.notFound('Event not found');
    return rooftopEvent;
  });
  findSavedEventsRepository.mock.mockImplementation(async () => [savedRow]);
  saveEventRepository.mock.mockImplementation(async () => undefined);
  deleteSavedEventRepository.mock.mockImplementation(async () => true);
});

const auth = { Authorization: 'Bearer access-1' };

test('every saved-events route answers 401 without a token', async () => {
  const responses = await Promise.all([
    request(app).get('/api/saved-events'),
    request(app).put(`/api/saved-events/${EVENT_ID}`),
    request(app).delete(`/api/saved-events/${EVENT_ID}`),
  ]);

  assert.deepEqual(responses.map((res) => res.status), [401, 401, 401]);
});

test('GET /api/saved-events returns the favorites of the user in the token', async () => {
  const res = await request(app).get('/api/saved-events').set(auth);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [savedRow]);
  assert.deepEqual(findSavedEventsRepository.mock.calls[0].arguments, [USER_ID]);
});

test('PUT /api/saved-events/:eventId saves for the token user and answers 204', async () => {
  const res = await request(app).put(`/api/saved-events/${EVENT_ID}`).set(auth);

  assert.equal(res.status, 204);
  assert.deepEqual(saveEventRepository.mock.calls[0].arguments, [USER_ID, EVENT_ID]);
});

test('PUT /api/saved-events/:eventId ignores a user id sent in the body', async () => {
  await request(app).put(`/api/saved-events/${EVENT_ID}`).set(auth).send({ userId: 'someone-else' });

  assert.deepEqual(saveEventRepository.mock.calls[0].arguments, [USER_ID, EVENT_ID]);
});

test('PUT /api/saved-events/:eventId answers 404 and saves nothing for a missing event', async () => {
  const res = await request(app).put(`/api/saved-events/${MISSING_EVENT_ID}`).set(auth);

  assert.equal(res.status, 404);
  assert.equal(saveEventRepository.mock.callCount(), 0);
});

test('PUT /api/saved-events/:eventId answers 400 for an invalid id', async () => {
  const res = await request(app).put('/api/saved-events/evt-1').set(auth);

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Invalid event id');
});

test('DELETE /api/saved-events/:eventId removes the token user favorite and answers 204', async () => {
  const res = await request(app).delete(`/api/saved-events/${EVENT_ID}`).set(auth);

  assert.equal(res.status, 204);
  assert.deepEqual(deleteSavedEventRepository.mock.calls[0].arguments, [USER_ID, EVENT_ID]);
});

test('DELETE /api/saved-events/:eventId is idempotent: 204 when it was not saved', async () => {
  deleteSavedEventRepository.mock.mockImplementation(async () => false);

  const res = await request(app).delete(`/api/saved-events/${EVENT_ID}`).set(auth);

  assert.equal(res.status, 204);
});

test('DELETE /api/saved-events/:eventId answers 400 for an invalid id', async () => {
  const res = await request(app).delete('/api/saved-events/not-a-uuid').set(auth);

  assert.equal(res.status, 400);
});
