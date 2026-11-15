// The only user-app module that reads process.env. NEXT_PUBLIC_* values are inlined at build
// time and are public: never put secrets here. Each variable is read with a literal
// process.env.NAME access so Next can inline it.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Used only for Realtime (Broadcast): the publishable key, never the secret key
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Help > contact. Optional: when it is not set, the app says contact is not configured instead of
// showing an address nobody reads
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '';

export const isRealtimeConfigured = (): boolean =>
  SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== '';
