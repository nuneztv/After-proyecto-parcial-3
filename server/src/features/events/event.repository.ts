import { pool } from '../../db/db';
import { Event, EventActivity, EventFilters, EventStats } from './event.types';

const EVENT_COLUMNS = `
  e.id, e.title, e.description, e.venue_name AS "venueName", e.address,
  e.image_url AS "imageUrl", e.categories, e.status, e.starts_at AS "startsAt",
  e.ends_at AS "endsAt", e.latitude, e.longitude, e.capacity, e.occupied,
  e.rating::float AS rating, e.section, e.map_label AS "mapLabel", e.created_at AS "createdAt"`;

const ACTIVITY_COLUMNS = `
  a.id, a.event_id AS "eventId", a.message, a.created_at AS "createdAt"`;

// ILIKE treats % and _ as wildcards: escape them so a search for "100%" matches literally
const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export const findEventsRepository = async (filters: EventFilters): Promise<Event[]> => {
  const result = await pool.query<Event>(
    `SELECT ${EVENT_COLUMNS}
     FROM public.events e
     WHERE ($1 = '' OR e.title ILIKE '%' || $1 || '%' OR e.venue_name ILIKE '%' || $1 || '%')
       AND ($2 = 'all' OR $2 = ANY(e.categories))
       AND ($3 = 'all' OR e.status = $3)
     ORDER BY e.starts_at ASC, e.id ASC`,
    [escapeLikePattern(filters.search), filters.category, filters.status],
  );

  return result.rows;
};

export const findEventByIdRepository = async (id: string): Promise<Event | undefined> => {
  const result = await pool.query<Event>(
    `SELECT ${EVENT_COLUMNS} FROM public.events e WHERE e.id = $1`,
    [id],
  );

  return result.rows[0];
};

// "Today" is the Bogota calendar day: starts_at::date alone would use UTC and miss late events
export const getEventStatsRepository = async (): Promise<EventStats> => {
  const result = await pool.query<EventStats>(
    `WITH live AS (
       SELECT occupied, capacity FROM public.events WHERE status = 'live'
     ),
     today AS (
       SELECT count(*)::int AS total
       FROM public.events
       WHERE status = 'live'
         OR (starts_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
     )
     SELECT
       COALESCE(sum(live.occupied), 0)::int AS "peopleNow",
       count(*)::int AS "activeEvents",
       (SELECT total FROM today) AS "eventsToday",
       COALESCE(round(100.0 * sum(live.occupied) / NULLIF(sum(live.capacity), 0)), 0)::int AS "capacityPercent"
     FROM live`,
  );

  return result.rows[0];
};

export const findEventActivityRepository = async (
  eventId: string,
  limit: number,
): Promise<EventActivity[]> => {
  const result = await pool.query<EventActivity>(
    `SELECT ${ACTIVITY_COLUMNS}
     FROM public.event_activity a
     WHERE a.event_id = $1
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $2`,
    [eventId, limit],
  );

  return result.rows;
};

export const findRecentActivityRepository = async (limit: number): Promise<EventActivity[]> => {
  const result = await pool.query<EventActivity>(
    `SELECT ${ACTIVITY_COLUMNS}
     FROM public.event_activity a
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows;
};
