import dotenv from 'dotenv';

dotenv.config();

export const PORT = Number(process.env.PORT) || 4000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

// Supabase Postgres (connection pooler)
export const DB_HOST = process.env.DB_HOST || '';
export const DB_PORT = Number(process.env.DB_PORT) || 6543;
export const DB_NAME = process.env.DB_NAME || 'postgres';
export const DB_USER = process.env.DB_USER || '';
export const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Supabase API. The secret key never leaves the server
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

// Open admin self-registration (demo). Set to "false" once the real admins exist
export const ADMIN_SIGNUP_ENABLED = process.env.ADMIN_SIGNUP_ENABLED !== 'false';

export const isDatabaseConfigured = (): boolean => Boolean(DB_HOST && DB_USER && DB_PASSWORD);
export const isSupabaseConfigured = (): boolean => Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
