import { Pool } from 'pg';
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from '../config';
import { seedDb } from './seed';

export const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  // Supabase only accepts TLS connections
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// Idempotent: only CREATE ... IF NOT EXISTS. Never drop or alter tables here.
export const initDb = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // The browser never queries tables directly: with RLS on and no policies, the
  // publishable key cannot read profiles; the server connects as postgres and bypasses RLS.
  await pool.query('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;');

  // After profiles: events.created_by references it
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      venue_name TEXT NOT NULL,
      address TEXT NOT NULL,
      image_url TEXT,
      categories TEXT[] NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('live', 'open', 'almost-full', 'closed')),
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      capacity INT NOT NULL CHECK (capacity > 0),
      occupied INT NOT NULL DEFAULT 0 CHECK (occupied >= 0),
      rating NUMERIC(2,1) NOT NULL DEFAULT 0,
      section TEXT CHECK (section IN ('happening', 'tonight', 'trending')),
      map_label TEXT,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT events_occupied_within_capacity CHECK (occupied <= capacity),
      CONSTRAINT events_ends_after_starts CHECK (ends_at IS NULL OR ends_at > starts_at)
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_events_starts_at ON public.events(starts_at);');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.event_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_event_activity_event_created ON public.event_activity(event_id, created_at DESC);',
  );

  // Same as profiles: only the server (postgres role) reads these tables
  await pool.query('ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;');
  await pool.query('ALTER TABLE public.event_activity ENABLE ROW LEVEL SECURITY;');

  await seedDb(pool);
};
