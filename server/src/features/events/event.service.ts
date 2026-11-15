import Boom from '@hapi/boom';
import { broadcast, EVENTS_CHANNEL, REALTIME_EVENTS } from '../../lib/realtime';
import { isUserImageUrl } from '../../lib/storage';
import {
  createEventRepository,
  findEventActivityRepository,
  findEventByIdRepository,
  findEventsRepository,
  findRecentActivityRepository,
  getEventStatsRepository,
  updateEventRepository,
  updateOccupancyRepository,
} from './event.repository';
import {
  CreateEventDTO,
  Event,
  EventActivityWithEvent,
  EventFilters,
  EventStats,
  OccupancyUpdate,
  UpdateEventDTO,
} from './event.types';

export const getEventsService = async (filters: EventFilters): Promise<Event[]> =>
  findEventsRepository(filters);

export const getEventByIdService = async (id: string): Promise<Event> => {
  const event = await findEventByIdRepository(id);

  if (!event) {
    throw Boom.notFound('Event not found');
  }

  return event;
};

export const getEventStatsService = async (): Promise<EventStats> => getEventStatsRepository();

// An unknown event is a 404, not an empty feed, so the admin page can show "not found"
export const getEventActivityService = async (
  eventId: string,
  limit: number,
): Promise<EventActivityWithEvent[]> => {
  await getEventByIdService(eventId);

  return findEventActivityRepository(eventId, limit);
};

export const getRecentActivityService = async (
  limit: number,
): Promise<EventActivityWithEvent[]> =>
  findRecentActivityRepository(limit);

// Broadcasts are not awaited: they never throw and must not delay the response
export const createEventService = async (dto: CreateEventDTO, userId: string): Promise<Event> => {
  const event = await createEventRepository(dto, userId);

  void broadcast(EVENTS_CHANNEL, REALTIME_EVENTS.eventCreated, { id: event.id });

  return event;
};

// A new image must come from this admin's Storage folder; keeping the stored one (a seed path or
// another admin's upload) is always allowed, and the repository compares it under the row lock
export const updateEventService = async (
  id: string,
  dto: UpdateEventDTO,
  userId: string,
): Promise<Event> => {
  const result = await updateEventRepository(id, dto, (imageUrl) =>
    isUserImageUrl(imageUrl, userId),
  );

  if (result.kind === 'not-found') {
    throw Boom.notFound('Event not found');
  }

  if (result.kind === 'capacity-below-occupancy') {
    throw Boom.conflict(
      `Capacity cannot be lower than the current occupancy (${result.occupied} people)`,
    );
  }

  if (result.kind === 'ends-before-start') {
    throw Boom.badRequest('End must be after start');
  }

  if (result.kind === 'image-not-allowed') {
    throw Boom.badRequest('Invalid image URL');
  }

  void broadcast(EVENTS_CHANNEL, REALTIME_EVENTS.eventUpdated, { id: result.event.id });

  return result.event;
};

export const updateOccupancyService = async (
  id: string,
  delta: number,
): Promise<OccupancyUpdate> => {
  const result = await updateOccupancyRepository(id, delta);

  if (result.kind === 'not-found') {
    throw Boom.notFound('Event not found');
  }

  if (result.kind === 'out-of-range') {
    throw Boom.conflict('Occupancy must stay between 0 and capacity');
  }

  // The repository returns only after COMMIT, so listeners never see a rolled-back count
  void broadcast(EVENTS_CHANNEL, REALTIME_EVENTS.eventUpdated, { id: result.event.id });
  void broadcast(EVENTS_CHANNEL, REALTIME_EVENTS.activityCreated, {
    id: result.activity.id,
    eventId: result.activity.eventId,
  });

  return { event: result.event, activity: result.activity };
};
