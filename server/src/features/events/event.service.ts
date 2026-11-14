import Boom from '@hapi/boom';
import {
  findEventActivityRepository,
  findEventByIdRepository,
  findEventsRepository,
  findRecentActivityRepository,
  getEventStatsRepository,
} from './event.repository';
import { Event, EventActivity, EventFilters, EventStats } from './event.types';

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
