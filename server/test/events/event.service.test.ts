import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { CreateEventDTO, UpdateEventDTO } from '../../src/features/events/event.types';
import { asyncMock, statusOf } from '../helpers/supabaseMocks';
import {
  checkedInEvent,
  checkInActivity,
  createdEvent,
  editedEvent,
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
const updateEventRepository = asyncMock();
// Replaces lib/storage so the image ownership rule is observable without a real Supabase URL
const isUserImageUrl = mock.fn((_url: string, _userId: string): boolean => true);
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
    updateEventRepository,
  },
});

mock.module('../../src/lib/storage', {
  namedExports: { isUserImageUrl },
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
    updateEventRepository,
    broadcast,
  ].forEach((fn) => fn.mock.resetCalls());
  isUserImageUrl.mock.resetCalls();
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

test('getRecentActivityService returns the rows with their nested event unchanged', async () => {
  findRecentActivityRepository.mock.mockImplementation(async () => [rooftopActivity]);

  const activity = await service.getRecentActivityService(20);

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

const updateDto: UpdateEventDTO = { title: 'Rooftop Sessions XL', capacity: 450 };

const updateReturns = (result: unknown): void => {
  updateEventRepository.mock.mockImplementation(async () => result);
};

// The image predicate the service handed to the repository on its first call
const imagePredicate = (): ((imageUrl: string) => boolean) =>
  updateEventRepository.mock.calls[0].arguments[2] as (imageUrl: string) => boolean;

test('updateEventService passes the id and DTO to the repository', async () => {
  updateReturns({ kind: 'ok', event: editedEvent });

  await service.updateEventService(EVENT_ID, updateDto, 'user-1');

  assert.deepEqual(updateEventRepository.mock.calls[0].arguments.slice(0, 2), [
    EVENT_ID,
    { title: 'Rooftop Sessions XL', capacity: 450 },
  ]);
});

test('updateEventService returns the updated event', async () => {
  updateReturns({ kind: 'ok', event: editedEvent });

  const event = await service.updateEventService(EVENT_ID, updateDto, 'user-1');

  assert.deepEqual(event, editedEvent);
});

test('updateEventService checks a new image with isUserImageUrl and the caller user id', async () => {
  updateReturns({ kind: 'ok', event: editedEvent });

  await service.updateEventService(EVENT_ID, updateDto, 'user-1');
  imagePredicate()('https://cdn.example.com/new.png');

  assert.deepEqual(isUserImageUrl.mock.calls[0].arguments, [
    'https://cdn.example.com/new.png',
    'user-1',
  ]);
});

test('updateEventService image predicate returns what isUserImageUrl answers', async () => {
  updateReturns({ kind: 'ok', event: editedEvent });
  isUserImageUrl.mock.mockImplementationOnce(() => false);

  await service.updateEventService(EVENT_ID, updateDto, 'user-1');

  assert.equal(imagePredicate()('https://evil.example.com/x.png'), false);
});

test('updateEventService throws 404 "Event not found" when the event does not exist', async () => {
  updateReturns({ kind: 'not-found' });

  await assert.rejects(
    () => service.updateEventService(MISSING_EVENT_ID, updateDto, 'user-1'),
    (error) => statusOf(error) === 404 && (error as Error).message === 'Event not found',
  );
});

test('updateEventService throws 409 with the occupancy when capacity is below it', async () => {
  updateReturns({ kind: 'capacity-below-occupancy', occupied: 342 });

  await assert.rejects(
    () => service.updateEventService(EVENT_ID, { capacity: 100 }, 'user-1'),
    (error) =>
      statusOf(error) === 409 &&
      (error as Error).message ===
        'Capacity cannot be lower than the current occupancy (342 people)',
  );
});

test('updateEventService throws 400 "End must be after start" against the stored dates', async () => {
  updateReturns({ kind: 'ends-before-start' });

  await assert.rejects(
    () => service.updateEventService(EVENT_ID, { startsAt: '2026-11-16T00:00:00Z' }, 'user-1'),
    (error) => statusOf(error) === 400 && (error as Error).message === 'End must be after start',
  );
});

test('updateEventService throws 400 "Invalid image URL" for another user\'s new image', async () => {
  updateReturns({ kind: 'image-not-allowed' });

  await assert.rejects(
    () =>
      service.updateEventService(EVENT_ID, { imageUrl: 'https://evil.example.com/x.png' }, 'user-1'),
    (error) => statusOf(error) === 400 && (error as Error).message === 'Invalid image URL',
  );
});

test('updateEventService broadcasts event-updated with only the event id on success', async () => {
  updateReturns({ kind: 'ok', event: editedEvent });

  await service.updateEventService(EVENT_ID, updateDto, 'user-1');

  assert.deepEqual(broadcastArgs(), [['events', 'event-updated', { id: EVENT_ID }]]);
});

for (const result of [
  { kind: 'not-found' },
  { kind: 'capacity-below-occupancy', occupied: 342 },
  { kind: 'ends-before-start' },
  { kind: 'image-not-allowed' },
]) {
  test(`updateEventService does not broadcast on ${result.kind}`, async () => {
    updateReturns(result);

    await assert.rejects(() => service.updateEventService(EVENT_ID, updateDto, 'user-1'));
    assert.equal(broadcast.mock.callCount(), 0);
  });
}

test('updateEventService does not broadcast when the repository throws', async () => {
  updateEventRepository.mock.mockImplementation(async () => {
    throw new Error('update failed');
  });

  await assert.rejects(() => service.updateEventService(EVENT_ID, updateDto, 'user-1'));
  assert.equal(broadcast.mock.callCount(), 0);
});
