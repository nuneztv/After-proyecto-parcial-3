import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, SUPABASE_SECRET_KEY, SUPABASE_URL } from '../config';

const createServerClient = (): SupabaseClient => {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  }

  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

let adminClient: SupabaseClient | null = null;

// Shared client for token validation, admin auth API, storage and realtime.
// Never call signIn/signUp on it: a stored user session would replace the secret key
// in every later request. Created lazily so the mock features keep working without Supabase.
export const getSupabase = (): SupabaseClient => {
  adminClient ??= createServerClient();
  return adminClient;
};

// A fresh client per sign-in/sign-up/refresh, so user sessions never leak between requests
export const createAuthClient = (): SupabaseClient => createServerClient();
