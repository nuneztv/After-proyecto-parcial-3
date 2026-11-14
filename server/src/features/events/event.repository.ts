import { pool } from '../../db/db';
import {
  CreateEventDTO,
  Event,
  EventActivity,
  EventFilters,
  EventStats,
  OccupancyUpdateResult,
} from './event.types';

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

// Aliasing the target table lets INSERT/UPDATE ... RETURNING reuse the same column lists
export const createEventRepository = async (dto: CreateEventDTO, userId: string): Promise<Event> => {
  const result = await pool.query<Event>(
    `INSERT INTO public.events AS e
       (title, description, venue_name, address, starts_at, ends_at,
        latitude, longitude, capacity, categories, image_url, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${EVENT_COLUMNS}`,
    [
      dto.title,
      dto.description,
      dto.venueName,
      dto.address,
      dto.startsAt,
      dto.endsAt,
      dto.latitude,
      dto.longitude,
      dto.capacity,
      dto.categories,
      dto.imageUrl,
      userId,
    ],
  );

  return result.rows[0];
};

const buildOccupancyMessage = (delta: number, event: Event): string => {
  const amount = Math.abs(delta);
  const action = delta > 0 ? 'check-in' : 'check-out';
  const sign = delta > 0 ? '+' : '-';

  return `${sign}${amount} ${action}${amount === 1 ? '' : 's'} at ${event.title} (${event.occupied}/${event.capacity})`;
};

// Row lock + check + update + activity in one transaction: concurrent check-ins cannot
// overshoot capacity and the activity feed never drifts from the stored count
export const updateOccupancyRepository = async (
  id: string,
  delta: number,
): Promise<OccupancyUpdateResult> => {
  const client = await pool.connect();
  let failure: Error | undefined;

  try {
    await client.query('BEGIN');

    const current = await client.query<{ occupied: number; capacity: number }>(
      'SELECT occupied, capacity FROM public.events WHERE id = $1 FOR UPDATE',
      [id],
    );
    const row = current.rows[0];

    if (!row) {
      await client.query('ROLLBACK');
      return { kind: 'not-found' };
    }

    const next = row.occupied + delta;

    if (next < 0 || next > row.capacity) {
      await client.query('ROLLBACK');
      return { kind: 'out-of-range' };
    }

    const updated = await client.query<Event>(
      `UPDATE public.events e SET occupied = e.occupied + $2 WHERE e.id = $1 RETURNING ${EVENT_COLUMNS}`,
      [id, delta],
    );
    const event = updated.rows[0];

    const inserted = await client.query<EventActivity>(
      `INSERT INTO public.event_activity AS a (event_id, message)
       VALUES ($1, $2)
       RETURNING ${ACTIVITY_COLUMNS}`,
      [id, buildOccupancyMessage(delta, event)],
    );

    await client.query('COMMIT');

    return { kind: 'ok', event, activity: inserted.rows[0] };
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));

    // A failed ROLLBACK (e.g. dropped connection) must not hide the original error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('ROLLBACK failed', rollbackError);
    }

    throw error;
  } finally {
    // Passing the error makes the pool discard this connection instead of reusing it
    client.release(failure);
  }
};
