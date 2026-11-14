import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { asyncMock, statusOf } from '../helpers/supabaseMocks';
import {
  EVENT_ID,
  MISSING_EVENT_ID,
  rooftopActivity,
  rooftopEvent,
  seedStats,
} from '../helpers/eventFixtures';

const findEventsRepository = asyncMock();
const findEventByIdRepository = asyncMock();
const getEventStatsRepository = asyncMock();
const findEventActivityRepository = asyncMock();
const findRecentActivityRepository = asyncMock();

mock.module('../../src/features/events/event.repository', {
  namedExports: {
    findEventsRepository,
    findEventByIdRepository,
    getEventStatsRepository,
    findEventActivityRepository,
    findRecentActivityRepository,
  },
});

let service: typeof import('../../src/features/events/event.service');

before(async () => {
  service = await import('../../src/features/events/event.service');
});

beforeEach(() => {
  [
    findEventsRepository,
    findEventByIdRepository,
    getEventStatsRepository,
    findEventActivityRepository,
    findRecentActivityRepository,
  ].forEach((fn) => fn.mock.resetCalls());
});

test('getEventsService passes the filters to the repository', async () => {
  findEventsRepository.mock.mockImplementation(async () => [rooftopEvent]);
  const filters = { search: 'rooftop', category: 'party' as const, status: 'live' as const };

  await service.getEventsService(filters);

  assert.deepEqual(findEventsRepository.mock.calls[0].arguments, [
    { search: 'rooftop', category: 'party', status: 'live' },
  ]);
});

test('getEventsService returns the repository rows', async () => {
  findEventsRepository.mock.mockImplementation(async () => [rooftopEvent]);

  const events = await service.getEventsService({ search: '', category: 'all', status: 'all' });

  assert.deepEqual(events, [rooftopEvent]);
});

test('getEventByIdService returns the event when it exists', async () => {
  findEventByIdRepository.mock.mockImplementation(async () => rooftopEvent);

  const event = await service.getEventByIdService(EVENT_ID);

  assert.deepEqual(event, rooftopEvent);
});

test('getEventByIdService throws 404 when the event does not exist', async () => {
  findEventByIdRepository.mock.mockImplementation(async () => undefined);

  await assert.rejects(
    () => service.getEventByIdService(MISSING_EVENT_ID),
    (error) => statusOf(error) === 404 && (error as Error).message === 'Event not found',
  );
});

test('getEventStatsService returns the repository stats', async () => {
  getEventStatsRepository.mock.mockImplementation(async () => seedStats);

  const stats = await service.getEventStatsService();

  assert.deepEqual(stats, { peopleNow: 572, activeEvents: 2, eventsToday: 5, capacityPercent: 57 });
});

test('getEventActivityService throws 404 when the event does not exist', async () => {
  findEventByIdRepository.mock.mockImplementation(async () => undefined);

  await assert.rejects(
    () => service.getEventActivityService(MISSING_EVENT_ID, 50),
    (error) => statusOf(error) === 404,
  );
});

test('getEventActivityService does not read activity for a missing event', async () => {
  findEventByIdRepository.mock.mockImplementation(async () => undefined);

  await assert.rejects(() => service.getEventActivityService(MISSING_EVENT_ID, 50));
  assert.equal(findEventActivityRepository.mock.callCount(), 0);
});

test('getEventActivityService reads the activity with the event id and limit', async () => {
  findEventByIdRepository.mock.mockImplementation(async () => rooftopEvent);
  findEventActivityRepository.mock.mockImplementation(async () => [rooftopActivity]);

  await service.getEventActivityService(EVENT_ID, 50);

  assert.deepEqual(findEventActivityRepository.mock.calls[0].arguments, [EVENT_ID, 50]);
});

test('getEventActivityService returns the activity rows', async () => {
  findEventByIdRepository.mock.mockImplementation(async () => rooftopEvent);
  findEventActivityRepository.mock.mockImplementation(async () => [rooftopActivity]);

  const activity = await service.getEventActivityService(EVENT_ID, 50);

  assert.deepEqual(activity, [rooftopActivity]);
});

test('getRecentActivityService passes the limit to the repository', async () => {
  findRecentActivityRepository.mock.mockImplementation(async () => [rooftopActivity]);

  await service.getRecentActivityService(20);

  assert.deepEqual(findRecentActivityRepository.mock.calls[0].arguments, [20]);
});
