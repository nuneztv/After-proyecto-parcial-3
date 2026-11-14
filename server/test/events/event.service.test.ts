import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { CreateEventDTO } from '../../src/features/events/event.types';
import { asyncMock, statusOf } from '../helpers/supabaseMocks';
import {
  checkedInEvent,
  checkInActivity,
  createdEvent,
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
const createEventRepository = asyncMock();
const updateOccupancyRepository = asyncMock();
// Replaces lib/realtime so no test ever sends a real broadcast to Supabase
const broadcast = asyncMock();

mock.module('../../src/features/events/event.repository', {
  namedExports: {
    findEventsRepository,
    findEventByIdRepository,
    getEventStatsRepository,
    findEventActivityRepository,
    findRecentActivityRepository,
    createEventRepository,
    updateOccupancyRepository,
  },
});

mock.module('../../src/lib/realtime', {
  namedExports: {
    broadcast,
    EVENTS_CHANNEL: 'events',
    REALTIME_EVENTS: {
      eventCreated: 'event-created',
      eventUpdated: 'event-updated',
      activityCreated: 'activity-created',
    },
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
    createEventRepository,
    updateOccupancyRepository,
    broadcast,
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

const createDto: CreateEventDTO = {
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
};

test('createEventService passes the DTO and the user id to the repository', async () => {
  createEventRepository.mock.mockImplementation(async () => createdEvent);

  await service.createEventService(createDto, 'user-1');

  assert.deepEqual(createEventRepository.mock.calls[0].arguments, [createDto, 'user-1']);
});

test('createEventService returns the created event', async () => {
  createEventRepository.mock.mockImplementation(async () => createdEvent);

  const event = await service.createEventService(createDto, 'user-1');

  assert.deepEqual(event, createdEvent);
});

test('updateOccupancyService passes the id and delta to the repository', async () => {
  updateOccupancyRepository.mock.mockImplementation(async () => ({
    kind: 'ok',
    event: checkedInEvent,
    activity: checkInActivity,
  }));

  await service.updateOccupancyService(EVENT_ID, 1);

  assert.deepEqual(updateOccupancyRepository.mock.calls[0].arguments, [EVENT_ID, 1]);
});

test('updateOccupancyService returns the updated event and its activity', async () => {
  updateOccupancyRepository.mock.mockImplementation(async () => ({
    kind: 'ok',
    event: checkedInEvent,
    activity: checkInActivity,
  }));

  const result = await service.updateOccupancyService(EVENT_ID, 1);

  assert.deepEqual(result, { event: checkedInEvent, activity: checkInActivity });
});

test('updateOccupancyService throws 404 "Event not found" when the event does not exist', async () => {
  updateOccupancyRepository.mock.mockImplementation(async () => ({ kind: 'not-found' }));

  await assert.rejects(
    () => service.updateOccupancyService(MISSING_EVENT_ID, 1),
    (error) => statusOf(error) === 404 && (error as Error).message === 'Event not found',
  );
});

test('updateOccupancyService throws 409 when occupancy would leave 0..capacity', async () => {
  updateOccupancyRepository.mock.mockImplementation(async () => ({ kind: 'out-of-range' }));

  await assert.rejects(
    () => service.updateOccupancyService(EVENT_ID, 50),
    (error) =>
      statusOf(error) === 409 &&
      (error as Error).message === 'Occupancy must stay between 0 and capacity',
  );
});

const broadcastArgs = (): unknown[][] => broadcast.mock.calls.map((call) => call.arguments);

test('createEventService broadcasts event-created with only the event id', async () => {
  createEventRepository.mock.mockImplementation(async () => createdEvent);

  await service.createEventService(createDto, 'user-1');

  assert.deepEqual(broadcastArgs(), [['events', 'event-created', { id: createdEvent.id }]]);
});

test('createEventService does not broadcast when the repository fails', async () => {
  createEventRepository.mock.mockImplementation(async () => {
    throw new Error('insert failed');
  });

  await assert.rejects(() => service.createEventService(createDto, 'user-1'));
  assert.equal(broadcast.mock.callCount(), 0);
});

test('updateOccupancyService broadcasts id-only event-updated and activity-created signals on success', async () => {
  updateOccupancyRepository.mock.mockImplementation(async () => ({
    kind: 'ok',
    event: checkedInEvent,
    activity: checkInActivity,
  }));

  await service.updateOccupancyService(EVENT_ID, 1);

  assert.deepEqual(broadcastArgs(), [
    ['events', 'event-updated', { id: checkedInEvent.id }],
    ['events', 'activity-created', { id: checkInActivity.id, eventId: checkInActivity.eventId }],
  ]);
});

test('updateOccupancyService does not broadcast when the event does not exist', async () => {
  updateOccupancyRepository.mock.mockImplementation(async () => ({ kind: 'not-found' }));

  await assert.rejects(() => service.updateOccupancyService(MISSING_EVENT_ID, 1));
  assert.equal(broadcast.mock.callCount(), 0);
});

test('updateOccupancyService does not broadcast when occupancy would leave 0..capacity', async () => {
  updateOccupancyRepository.mock.mockImplementation(async () => ({ kind: 'out-of-range' }));

  await assert.rejects(() => service.updateOccupancyService(EVENT_ID, 50));
  assert.equal(broadcast.mock.callCount(), 0);
});
