import type { Pool } from 'pg';

// Demo data copied from the legacy client catalog (client/lib/events.ts), with evt-N mapped
// to fixed UUIDs. Times are offsets from the Bogota day of the first init; ON CONFLICT DO
// NOTHING freezes them afterwards, so re-running initDb never overwrites real changes.
// Constant literals only: no user input reaches these statements.
export const seedDb = async (db: Pool): Promise<void> => {
  await db.query(`
    INSERT INTO public.events (id, title, description, venue_name, address, image_url, categories, status,
      starts_at, ends_at, latitude, longitude, capacity, occupied, rating, section, map_label)
    SELECT v.id::uuid, v.title, v.description, v.venue_name, v.address, v.image_url, v.categories::text[], v.status,
      (date_trunc('day', now() AT TIME ZONE 'America/Bogota') + v.starts::interval) AT TIME ZONE 'America/Bogota',
      (date_trunc('day', now() AT TIME ZONE 'America/Bogota') + v.ends::interval) AT TIME ZONE 'America/Bogota',
      v.lat, v.lng, v.capacity, v.occupied, v.rating, v.section, v.map_label
    FROM (VALUES
      ('e0000000-0000-4000-8000-000000000001', 'Rooftop Sessions', 'Sunset rooftop party with resident DJs.',
        'Skyline Rooftop', 'Cra 8a #22-26, Cali', '/images/events/rooftop-sessions.jpg', '{rooftop,party}', 'live',
        '18 hours', '26 hours', 3.4516, -76.532, 400, 342, 4.8, 'happening', 'Rooftop'),
      ('e0000000-0000-4000-8000-000000000002', 'Night Talk''s Sessions', 'Vinyl and late-night drinks at Mandala Bar.',
        'Mandala Bar', 'Cra 4 #8-45, Cali', '/images/events/night-talks.jpg', '{bar,music}', 'live',
        '20 hours', '25 hours', 3.4491, -76.5364, 600, 230, 4.5, 'happening', 'Drinks'),
      ('e0000000-0000-4000-8000-000000000003', 'Jazz & Wine', 'Live jazz and wine at La Cebra.',
        'La Cebra', 'Av 6N #15-20, Cali', '/images/events/jazz-wine.jpg', '{music,bar}', 'almost-full',
        '21 hours', '24 hours 30 minutes', 3.4582, -76.5281, 200, 180, 4.6, 'tonight', 'Jazz'),
      ('e0000000-0000-4000-8000-000000000004', 'Indie Vibes', 'Independent bands at Metropolitan.',
        'Metropolitan', 'Cll 5 #3-18, Cali', '/images/events/indie-vibes.jpg', '{music,concert}', 'open',
        '21 hours 30 minutes', '25 hours 30 minutes', 3.4448, -76.5412, 150, 75, 4.4, 'tonight', 'Concert'),
      ('e0000000-0000-4000-8000-000000000005', 'Retro Night', 'Disco night with resident DJs.',
        'Disco Hall', 'Cra. 7 #72-13, Cali', '/retro.png', '{party}', 'open',
        '22 hours', '27 hours', 3.4534, -76.5355, 500, 210, 4.7, 'trending', 'Disco')
    ) AS v(id, title, description, venue_name, address, image_url, categories, status,
      starts, ends, lat, lng, capacity, occupied, rating, section, map_label)
    ON CONFLICT (id) DO NOTHING;
  `);

  // Each seeded activity is timestamped at its event's start, like the legacy mock feed
  await db.query(`
    INSERT INTO public.event_activity (id, event_id, message, created_at)
    SELECT v.id::uuid, e.id, v.message, e.starts_at
    FROM (VALUES
      ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
        'Rooftop Sessions is live at Skyline Rooftop'),
      ('a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002',
        'Night Talk''s Sessions is live at Mandala Bar'),
      ('a0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003',
        '180 people at Jazz & Wine'),
      ('a0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000004',
        '75 people at Indie Vibes'),
      ('a0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000005',
        '210 people at Retro Night')
    ) AS v(id, event_id, message)
    JOIN public.events e ON e.id = v.event_id::uuid
    ON CONFLICT (id) DO NOTHING;
  `);

  // The four tickets of the legacy products mock (prod-1..prod-4), now linked by event_id
  // instead of by name. Night Talk's Sessions had no ticket. The JOIN skips a ticket whose
  // event was deleted
  await db.query(`
    INSERT INTO public.products (id, event_id, name, category, price, currency, description, image_url)
    SELECT v.id::uuid, e.id, v.name, 'ticket', v.price, 'COP', v.description, v.image_url
    FROM (VALUES
      ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
        'Rooftop Sessions', 45000, 'Sunset rooftop party in Cali.', '/images/events/rooftop-sessions.jpg'),
      ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003',
        'Jazz & Wine', 38000, 'Live jazz and wine night.', '/images/events/jazz-wine.jpg'),
      ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000004',
        'Indie Vibes', 32000, 'Independent bands and lights.', '/images/events/indie-vibes.jpg'),
      ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000005',
        'Retro Night', 50000, 'Disco night with resident DJs.', '/retro.png')
    ) AS v(id, event_id, name, price, description, image_url)
    JOIN public.events e ON e.id = v.event_id::uuid
    ON CONFLICT (id) DO NOTHING;
  `);
};
