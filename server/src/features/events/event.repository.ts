import { pool } from '../../db/db';
import {
  CreateEventDTO,
  Event,
  EventActivity,
  EventActivityWithEvent,
  EventFilters,
  EventStats,
  OccupancyUpdateResult,
  UpdateEventDTO,
  UpdateEventResult,
} from './event.types';

const EVENT_COLUMNS = `
  e.id, e.title, e.description, e.venue_name AS "venueName", e.address,
  e.image_url AS "imageUrl", e.categories, e.status, e.starts_at AS "startsAt",
  e.ends_at AS "endsAt", e.latitude, e.longitude, e.capacity, e.occupied,
  e.rating::float AS rating, e.section, e.map_label AS "mapLabel", e.created_at AS "createdAt"`;

const ACTIVITY_COLUMNS = `
  a.id, a.event_id AS "eventId", a.message, a.created_at AS "createdAt"`;

// Feed rows with their event nested as one JSON object, built by Postgres in the same query
// (requires `JOIN public.events e ON e.id = a.event_id`). event_id is NOT NULL and cascades on
// delete, so the inner join never drops a row
const ACTIVITY_WITH_EVENT_COLUMNS = `${ACTIVITY_COLUMNS},
  json_build_object('id', e.id, 'title', e.title, 'status', e.status) AS event`;

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
): Promise<EventActivityWithEvent[]> => {
  const result = await pool.query<EventActivityWithEvent>(
    `SELECT ${ACTIVITY_WITH_EVENT_COLUMNS}
     FROM public.event_activity a
     JOIN public.events e ON e.id = a.event_id
     WHERE a.event_id = $1
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT $2`,
    [eventId, limit],
  );

  return result.rows;
};

export const findRecentActivityRepository = async (
  limit: number,
): Promise<EventActivityWithEvent[]> => {
  const result = await pool.query<EventActivityWithEvent>(
    `SELECT ${ACTIVITY_WITH_EVENT_COLUMNS}
     FROM public.event_activity a
     JOIN public.events e ON e.id = a.event_id
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

// Fixed whitelist: SET column names never come from the request, only the values do
const UPDATE_EVENT_COLUMNS: Record<keyof UpdateEventDTO, string> = {
  title: 'title',
  description: 'description',
  venueName: 'venue_name',
  address: 'address',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  latitude: 'latitude',
  longitude: 'longitude',
  capacity: 'capacity',
  imageUrl: 'image_url',
};

const UPDATE_EVENT_FIELDS = Object.keys(UPDATE_EVENT_COLUMNS) as (keyof UpdateEventDTO)[];

// pg returns timestamptz as Date; the DTO carries ISO strings
const toTime = (value: Date | string): number =>
  value instanceof Date ? value.getTime() : Date.parse(value);

// Row lock + checks against the stored values + update in one transaction: a concurrent check-in
// cannot push occupancy above a capacity that is being lowered, and a partial date change is
// validated against the dates actually stored. isNewImageAllowed is decided by the service; it
// only runs when the image changes, because keeping the current image is always allowed
export const updateEventRepository = async (
  id: string,
  dto: UpdateEventDTO,
  isNewImageAllowed: (imageUrl: string) => boolean,
): Promise<UpdateEventResult> => {
  const client = await pool.connect();
  let failure: Error | undefined;

  try {
    await client.query('BEGIN');

    const current = await client.query<{
      occupied: number;
      capacity: number;
      starts_at: Date | string;
      ends_at: Date | string | null;
      image_url: string | null;
    }>(
      'SELECT occupied, capacity, starts_at, ends_at, image_url FROM public.events WHERE id = $1 FOR UPDATE',
      [id],
    );
    const row = current.rows[0];

    if (!row) {
      await client.query('ROLLBACK');
      return { kind: 'not-found' };
    }

    const capacity = dto.capacity ?? row.capacity;

    if (capacity < row.occupied) {
      await client.query('ROLLBACK');
      return { kind: 'capacity-below-occupancy', occupied: row.occupied };
    }

    const startsAt = dto.startsAt ?? row.starts_at;
    // endsAt: null means "no end", so only undefined falls back to the stored value
    const endsAt = dto.endsAt === undefined ? row.ends_at : dto.endsAt;

    if (endsAt !== null && toTime(endsAt) <= toTime(startsAt)) {
      await client.query('ROLLBACK');
      return { kind: 'ends-before-start' };
    }

    if (
      typeof dto.imageUrl === 'string' &&
      dto.imageUrl !== row.image_url &&
      !isNewImageAllowed(dto.imageUrl)
    ) {
      await client.query('ROLLBACK');
      return { kind: 'image-not-allowed' };
    }

    const assignments: string[] = [];
    const values: unknown[] = [id];

    for (const field of UPDATE_EVENT_FIELDS) {
      const value = dto[field];

      // A null address resets it to the venue name stored in the row. SET expressions read the
      // pre-update row, which is right: a venue sent in the same body already made the address
      // a string in the validator
      if (field === 'address' && value === null) {
        assignments.push(`${UPDATE_EVENT_COLUMNS.address} = ${UPDATE_EVENT_COLUMNS.venueName}`);
        continue;
      }

      if (value !== undefined) {
        values.push(value);
        assignments.push(`${UPDATE_EVENT_COLUMNS[field]} = $${values.length}`);
      }
    }

    // The validator guarantees at least one field; an empty SET would be a SQL syntax error
    if (assignments.length === 0) {
      throw new Error('updateEventRepository called without fields to update');
    }

    const updated = await client.query<Event>(
      `UPDATE public.events e SET ${assignments.join(', ')} WHERE e.id = $1 RETURNING ${EVENT_COLUMNS}`,
      values,
    );

    await client.query('COMMIT');

    return { kind: 'ok', event: updated.rows[0] };
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

const buildOccupancyMessage =(delta: number, event: Event): string => {
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
