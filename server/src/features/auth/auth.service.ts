import Boom from '@hapi/boom';
import { AuthError, Session as SupabaseSession } from '@supabase/supabase-js';
import { ADMIN_SIGNUP_ENABLED, CLIENT_URL, SUPABASE_SECRET_KEY, SUPABASE_URL } from '../../config';
import { createAuthClient, getSupabase } from '../../lib/supabase';
import { Role } from '../../shared/types';
import {
  createProfileService,
  ensureProfileService,
  getProfileByIdService,
} from '../profiles/profile.service';
import { Profile } from '../profiles/profile.types';
import {
  AuthResponse,
  LoginDTO,
  OAuthProvider,
  OAuthSessionDTO,
  RegisterDTO,
  Session,
} from './auth.types';

const toSession = (session: SupabaseSession): Session => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresAt: session.expires_at ?? 0,
});

// Supabase answers 4xx for user mistakes; anything else means the service itself failed
const isUpstreamFailure = (error: AuthError): boolean => !error.status || error.status >= 500;

export const registerService = async (dto: RegisterDTO, role: Role): Promise<AuthResponse> => {
  if (role === 'admin' && !ADMIN_SIGNUP_ENABLED) {
    throw Boom.forbidden('Administrator registration is closed');
  }

  const { data, error } = await createAuthClient().auth.signUp({
    email: dto.email,
    password: dto.password,
    options: { data: { full_name: dto.fullName } },
  });

  if (error) {
    if (isUpstreamFailure(error)) {
      throw Boom.badGateway('The authentication service failed to respond');
    }

    if (error.code === 'user_already_exists') {
      throw Boom.conflict('An account with this email already exists');
    }

    throw Boom.badRequest(error.message);
  }

  // With "Confirm email" on, Supabase hides existing accounts behind a user without identities
  if (!data.user || data.user.identities?.length === 0) {
    throw Boom.conflict('An account with this email already exists');
  }

  let user: Profile;

  try {
    user = await createProfileService({
      id: data.user.id,
      email: dto.email,
      fullName: dto.fullName,
      role,
    });
  } catch (profileError) {
    // Do not leave an auth user without a profile: it could never log in correctly
    await getSupabase().auth.admin.deleteUser(data.user.id);
    throw profileError;
  }

  return { user, session: data.session ? toSession(data.session) : null };
};

export const loginService = async (dto: LoginDTO, requiredRole?: Role): Promise<AuthResponse> => {
  const { data, error } = await createAuthClient().auth.signInWithPassword({
    email: dto.email,
    password: dto.password,
  });

  if (error || !data.session) {
    if (error && isUpstreamFailure(error)) {
      throw Boom.badGateway('The authentication service failed to respond');
    }

    if (error?.code === 'email_not_confirmed') {
      throw Boom.unauthorized('Please confirm your email before logging in');
    }

    throw Boom.unauthorized('Email or password is not correct');
  }

  const user = await getProfileByIdService(data.user.id);

  if (requiredRole && user.role !== requiredRole) {
    throw Boom.forbidden('This account is not an administrator');
  }

  return { user, session: toSession(data.session) };
};

export const refreshService = async (refreshToken: string): Promise<Session> => {
  const { data, error } = await createAuthClient().auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    if (error && isUpstreamFailure(error)) {
      throw Boom.badGateway('The authentication service failed to respond');
    }

    throw Boom.unauthorized('Session expired, please log in again');
  }

  return toSession(data.session);
};

export const getMeService = async (userId: string): Promise<Profile> => getProfileByIdService(userId);

// scope 'local' revokes the refresh token(s) of this session only, so other devices stay
// signed in. The access token is a stateless JWT and stays valid until it expires (~1 h)
export const logoutService = async (accessToken: string): Promise<void> => {
  let failure: unknown;

  try {
    const { error } = await getSupabase().auth.admin.signOut(accessToken, 'local');
    failure = error;
  } catch (error) {
    // auth-js returns AuthErrors but rethrows anything else (e.g. an unexpected fetch failure)
    failure = error;
  }

  if (failure) {
    console.error('Supabase signOut failed', failure);
    throw Boom.badGateway('Logout failed');
  }
};

// Where Supabase sends the user back (both URLs must be listed in Supabase > Authentication >
// URL Configuration > Redirect URLs)
export const PASSWORD_RESET_REDIRECT = `${CLIENT_URL}/reset-password`;
export const OAUTH_REDIRECT = `${CLIENT_URL}/auth/callback`;

const OAUTH_LABELS: Record<OAuthProvider, string> = { google: 'Google', apple: 'Apple' };

// Always succeeds for a well-formed email, whether or not an account exists, so the endpoint
// cannot be used to find out who is registered. Only rate limits and outages are reported
export const requestPasswordResetService = async (email: string): Promise<void> => {
  const { error } = await createAuthClient().auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RESET_REDIRECT,
  });

  if (!error) return;

  if (error.status === 429) {
    throw Boom.tooManyRequests('Too many reset requests, please try again in a few minutes');
  }

  if (isUpstreamFailure(error)) {
    throw Boom.badGateway('The authentication service failed to respond');
  }

  console.error('resetPasswordForEmail rejected the request', error);
};

// The user arrives from the reset email with a short-lived recovery session; authMiddleware has
// already validated its access token. That recovery session is ended afterwards, so the user
// logs in again with the new password
export const resetPasswordService = async (
  userId: string,
  accessToken: string,
  password: string,
): Promise<void> => {
  const { error } = await getSupabase().auth.admin.updateUserById(userId, { password });

  if (error) {
    if (isUpstreamFailure(error)) {
      throw Boom.badGateway('The authentication service failed to respond');
    }

    // e.g. "New password should be different from the old password."
    throw Boom.badRequest(error.message);
  }

  try {
    await logoutService(accessToken);
  } catch {
    // Already logged by logoutService; the password did change, which is what the user asked
  }
};

// Supabase lists the enabled social providers in GET /auth/v1/settings. Checking first turns a
// provider that is not configured yet into a clear message instead of a Supabase error page
const isOAuthProviderEnabled = async (provider: OAuthProvider): Promise<boolean> => {
  let settings: { external?: Record<string, boolean> };

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_SECRET_KEY },
    });

    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    settings = (await response.json()) as { external?: Record<string, boolean> };
  } catch (error) {
    console.error('Could not read the Supabase auth settings', error);
    throw Boom.badGateway('The authentication service failed to respond');
  }

  return settings.external?.[provider] === true;
};

// The URL the browser opens to sign in with Google or Apple. The provider sends the user back to
// /auth/callback with the session tokens, which POST /api/auth/oauth/session then validates
export const getOAuthUrlService = async (provider: OAuthProvider): Promise<string> => {
  if (!(await isOAuthProviderEnabled(provider))) {
    throw Boom.serverUnavailable(`${OAUTH_LABELS[provider]} sign-in is not enabled yet`);
  }

  const { data, error } = await createAuthClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    console.error('signInWithOAuth failed', error);
    throw Boom.badGateway('The authentication service failed to respond');
  }

  return data.url;
};

const displayName = (metadata: Record<string, unknown>, email: string): string => {
  const name = metadata.full_name ?? metadata.name;
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : email.split('@')[0];
};

// Turns the tokens from /auth/callback into a normal After session. The access token is checked
// with Supabase (the client could send anything), and a first-time Google/Apple user gets a
// "client" profile, like POST /api/auth/register would create
export const createOAuthSessionService = async (dto: OAuthSessionDTO): Promise<AuthResponse> => {
  const { data, error } = await getSupabase().auth.getUser(dto.accessToken);

  if (error || !data.user) {
    if (error && isUpstreamFailure(error)) {
      throw Boom.badGateway('The authentication service failed to respond');
    }

    throw Boom.unauthorized('Invalid or expired sign-in, please try again');
  }

  const email = data.user.email;
  if (!email) {
    throw Boom.badRequest('This account has no email address');
  }

  const user = await ensureProfileService({
    id: data.user.id,
    email,
    fullName: displayName(data.user.user_metadata ?? {}, email),
  });

  return { user, session: dto };
};
