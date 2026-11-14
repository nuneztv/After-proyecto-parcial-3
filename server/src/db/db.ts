import { Pool } from 'pg';
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from '../config';

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
};
