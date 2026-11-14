// The only admin module that reads process.env. NEXT_PUBLIC_* values are inlined at
// build time and are public (Next's equivalent of Vite's VITE_*): never put secrets here.
// Each variable is read with a literal process.env.NAME access so Next can inline it.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Used only for Realtime (Broadcast): the publishable key, never the secret key
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const isRealtimeConfigured = (): boolean =>
  SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== '';
