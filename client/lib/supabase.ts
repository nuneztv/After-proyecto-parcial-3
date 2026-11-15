import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isRealtimeConfigured } from './config';

let client: SupabaseClient | null = null;

// Single browser client, used only for Realtime subscriptions. User auth goes through the API
// (lib/axios.ts), so this client never stores or refreshes a session.
// Returns null on the server and when Supabase is not configured: callers skip Realtime.
export const getRealtimeClient = (): SupabaseClient | null => {
  if (typeof window === 'undefined' || !isRealtimeConfigured()) return null;

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
};
