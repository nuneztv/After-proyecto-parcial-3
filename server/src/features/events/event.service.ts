import Boom from '@hapi/boom';
import { broadcast, EVENTS_CHANNEL, REALTIME_EVENTS } from '../../lib/realtime';
import {
  createEventRepository,
  findEventActivityRepository,
  findEventByIdRepository,
  findEventsRepository,
  findRecentActivityRepository,
  getEventStatsRepository,
  updateOccupancyRepository,
} from './event.repository';
import {
  CreateEventDTO,
  Event,
  EventActivity,
  EventFilters,
  EventStats,
  OccupancyUpdate,
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
): Promise<EventActivity[]> => {
  await getEventByIdService(eventId);

  return findEventActivityRepository(eventId, limit);
};

export const getRecentActivityService = async (limit: number): Promise<EventActivity[]> =>
  findRecentActivityRepository(limit);

// Broadcasts are not awaited: they never throw and must not delay the response
export const createEventService = async (dto: CreateEventDTO, userId: string): Promise<Event> => {
  const event = await createEventRepository(dto, userId);

  void broadcast(EVENTS_CHANNEL, REALTIME_EVENTS.eventCreated, { id: event.id });

  return event;
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
