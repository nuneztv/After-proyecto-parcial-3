# Repository

Only layer with SQL. Parameterized queries, typed rows, camelCase aliases. Uses the shared `pool` from `src/db/db.ts` (Supabase Postgres).

```ts
import { pool } from '../../db/db';
import { CreateEventDTO, Event } from './event.types';

const EVENT_COLUMNS = `
  e.id, e.title, e.description, e.venue_name AS "venueName", e.address,
  e.image_url AS "imageUrl", e.categories, e.status,
  e.starts_at AS "startsAt", e.ends_at AS "endsAt",
  e.latitude, e.longitude, e.capacity, e.occupied, e.rating::float AS rating,
  e.section, e.map_label AS "mapLabel"`;

export const findEventsRepository = async (search: string, category: string): Promise<Event[]> => {
  const result = await pool.query<Event>(
    `SELECT ${EVENT_COLUMNS}
     FROM public.events e
     WHERE ($1 = '' OR e.title ILIKE '%' || $1 || '%' OR e.venue_name ILIKE '%' || $1 || '%')
       AND ($2 = 'all' OR $2 = ANY(e.categories))
     ORDER BY e.starts_at ASC`,
    [search, category],
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

export const createEventRepository = async (event: CreateEventDTO): Promise<Event> => {
  const result = await pool.query<Event>(
    `INSERT INTO public.events AS e
       (title, description, venue_name, address, starts_at, capacity, latitude, longitude, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${EVENT_COLUMNS}`,
    [event.title, event.description ?? '', event.venueName, event.address, event.startsAt,
      event.capacity, event.latitude, event.longitude, event.createdBy],
  );

  return result.rows[0];
};

export const deleteEventRepository = async (id: string): Promise<boolean> => {
  const result = await pool.query('DELETE FROM public.events WHERE id = $1', [id]);

  return (result.rowCount ?? 0) > 0;
};
```

## JOINs with nested objects: `json_build_object`

The API returns nested objects (`payment.product.event`), built **in SQL**, not by N extra queries or by stitching arrays in the service:

```ts
export const findPaymentsByUserRepository = async (userId: string): Promise<PaymentWithProduct[]> => {
  const result = await pool.query<PaymentWithProduct>(
    `SELECT
       pay.id, pay.amount, pay.currency, pay.status, pay.created_at AS "createdAt",
       json_build_object(
         'id', p.id,
         'name', p.name,
         'price', p.price,
         'event', json_build_object(
           'id', e.id,
           'title', e.title,
           'venueName', e.venue_name,
           'imageUrl', e.image_url
         )
       ) AS product
     FROM public.payments pay
     JOIN public.products p ON p.id = pay.product_id
     JOIN public.events e ON e.id = p.event_id
     WHERE pay.user_id = $1
     ORDER BY pay.created_at DESC`,
    [userId],
  );

  return result.rows;
};
```

One-to-many (event with its tickets): `COALESCE(json_agg(json_build_object(...)) FILTER (WHERE p.id IS NOT NULL), '[]') AS products` with `GROUP BY e.id`.

## Aggregates: CTE instead of several queries

Admin stats in **one** round trip:

```ts
export const getEventStatsRepository = async (): Promise<EventStats> => {
  const result = await pool.query<EventStats>(
    `WITH live AS (
       SELECT occupied, capacity FROM public.events WHERE status = 'live'
     ),
     today AS (
       SELECT count(*)::int AS total FROM public.events
       WHERE starts_at::date = (now() AT TIME ZONE 'America/Bogota')::date
     )
     SELECT
       COALESCE(sum(live.occupied), 0)::int AS "peopleNow",
       count(live.*)::int AS "activeEvents",
       (SELECT total FROM today) AS "eventsToday",
       COALESCE(round(100.0 * sum(live.occupied) / NULLIF(sum(live.capacity), 0)), 0)::int AS "capacityPercent"
     FROM live`,
  );

  return result.rows[0];
};
```

Why a CTE: one round trip to Supabase (latency matters on a remote DB), one consistent snapshot of the data, and the query reads top-down like the definition of each stat.

## Rules

- `${CONSTANT}` interpolation is only for column lists you wrote; **values always go in `$n` params**.
- Single-row reads return `T | undefined`; the service decides what a miss means.
- Deletes return `boolean`.
- Dynamic `ORDER BY`: map from an allow-list object, never from raw input.
- Optional values: `dto.imageUrl ?? null`.
- User-scoped tables (`payments`, `saved_events`): include `WHERE user_id = $n` in every read/update/delete.
- Numeric/`bigint` columns come back as strings from `pg`: cast (`::int`, `::float`) in SQL.

## Transactions

```ts
import { PoolClient } from 'pg';

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

Put it in `src/db/db.ts`; repository functions that take part accept an optional `client: PoolClient | Pool = pool`.
