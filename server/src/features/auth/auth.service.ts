import Boom from '@hapi/boom';
import { AuthError, Session as SupabaseSession } from '@supabase/supabase-js';
import { ADMIN_SIGNUP_ENABLED } from '../../config';
import { createAuthClient, getSupabase } from '../../lib/supabase';
import { Role } from '../../shared/types';
import { createProfileService, getProfileByIdService } from '../profiles/profile.service';
import { Profile } from '../profiles/profile.types';
import { AuthResponse, LoginDTO, RegisterDTO, Session } from './auth.types';

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
