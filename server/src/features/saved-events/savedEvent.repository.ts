import { pool } from '../../db/db';
import { isoTimestamp, isoTimestampOrNull } from '../../shared/sql';
import { SavedEvent } from './savedEvent.types';

// Every query is scoped by user_id: a user can only read or change their own favorites
export const findSavedEventsRepository = async (userId: string): Promise<SavedEvent[]> => {
  const result = await pool.query<SavedEvent>(
    `SELECT s.event_id AS "eventId", ${isoTimestamp('s.created_at')} AS "savedAt",
       json_build_object(
         'id', e.id, 'title', e.title, 'description', e.description,
         'venueName', e.venue_name, 'address', e.address, 'imageUrl', e.image_url,
         'categories', e.categories, 'status', e.status,
         'startsAt', ${isoTimestamp('e.starts_at')},
         'endsAt', ${isoTimestampOrNull('e.ends_at')},
         'latitude', e.latitude, 'longitude', e.longitude,
         'capacity', e.capacity, 'occupied', e.occupied, 'rating', e.rating::float,
         'section', e.section, 'mapLabel', e.map_label, 'createdAt', ${isoTimestamp('e.created_at')}
       ) AS event
     FROM public.saved_events s
     JOIN public.events e ON e.id = s.event_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC, s.event_id ASC`,
    [userId],
  );

  return result.rows;
};

// Idempotent: saving an event twice keeps the first row (and its date). The SELECT inserts
// nothing if the event was deleted in the meantime, instead of failing on the foreign key
export const saveEventRepository = async (userId: string, eventId: string): Promise<void> => {
  await pool.query(
    `INSERT INTO public.saved_events (user_id, event_id)
     SELECT $1, e.id FROM public.events e WHERE e.id = $2
     ON CONFLICT (user_id, event_id) DO NOTHING`,
    [userId, eventId],
  );
};

// Returns whether a row was removed
export const deleteSavedEventRepository = async (
  userId: string,
  eventId: string,
): Promise<boolean> => {
  const result = await pool.query(
    'DELETE FROM public.saved_events WHERE user_id = $1 AND event_id = $2',
    [userId, eventId],
  );

  return (result.rowCount ?? 0) > 0;
};
