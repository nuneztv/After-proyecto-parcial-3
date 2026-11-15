import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import {
  adminProfile,
  asyncMock,
  authError,
  clientProfile,
  statusOf,
  supabaseSession,
  supabaseUser,
} from '../helpers/supabaseMocks';

const signUp = asyncMock();
const signInWithPassword = asyncMock();
const refreshSession = asyncMock();
const deleteUser = mock.fn(async () => ({ error: null }));
const createProfileService = asyncMock();
const getProfileByIdService = asyncMock();

mock.module('../../src/lib/supabase', {
  namedExports: {
    createAuthClient: () => ({ auth: { signUp, signInWithPassword, refreshSession } }),
    getSupabase: () => ({ auth: { admin: { deleteUser } } }),
  },
});
mock.module('../../src/config', { namedExports: { ADMIN_SIGNUP_ENABLED: true } });
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { createProfileService, getProfileByIdService },
});

let service: typeof import('../../src/features/auth/auth.service');

before(async () => {
  service = await import('../../src/features/auth/auth.service');
});

beforeEach(() => {
  [signUp, signInWithPassword, refreshSession, deleteUser, createProfileService, getProfileByIdService]
    .forEach((fn) => fn.mock.resetCalls());
});

const registerInput = { email: 'lina@after.app', password: 'secret123', fullName: 'Lina Sanchez' };

test('registerService creates an admin profile and returns the session', async () => {
  signUp.mock.mockImplementation(async () => ({
    data: { user: supabaseUser(), session: supabaseSession },
    error: null,
  }));
  createProfileService.mock.mockImplementation(async () => adminProfile);

  const result = await service.registerService(registerInput, 'admin');

  assert.deepEqual(result, {
    user: adminProfile,
    session: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1900000000 },
  });
});

test('registerService stores the requested role in the profile', async () => {
  signUp.mock.mockImplementation(async () => ({
    data: { user: supabaseUser(), session: supabaseSession },
    error: null,
  }));
  createProfileService.mock.mockImplementation(async () => adminProfile);

  await service.registerService(registerInput, 'admin');

  assert.deepEqual(createProfileService.mock.calls[0].arguments[0], {
    id: 'user-1',
    email: 'lina@after.app',
    fullName: 'Lina Sanchez',
    role: 'admin',
  });
});

test('registerService returns a null session when email confirmation is required', async () => {
  signUp.mock.mockImplementation(async () => ({
    data: { user: supabaseUser(), session: null },
    error: null,
  }));
  createProfileService.mock.mockImplementation(async () => adminProfile);

  const result = await service.registerService(registerInput, 'admin');

  assert.equal(result.session, null);
});

test('registerService throws 409 when Supabase reports an existing user', async () => {
  signUp.mock.mockImplementation(async () => ({
    data: { user: null, session: null },
    error: authError(422, 'user_already_exists'),
  }));

  await assert.rejects(() => service.registerService(registerInput, 'admin'), (error) => statusOf(error) === 409);
});

test('registerService throws 409 for an obfuscated existing user without identities', async () => {
  signUp.mock.mockImplementation(async () => ({
    data: { user: supabaseUser('user-1', []), session: null },
    error: null,
  }));

  await assert.rejects(() => service.registerService(registerInput, 'admin'), (error) => statusOf(error) === 409);
});

test('registerService throws 502 when the auth service fails', async () => {
  signUp.mock.mockImplementation(async () => ({
    data: { user: null, session: null },
    error: authError(500, 'unexpected_failure'),
  }));

  await assert.rejects(() => service.registerService(registerInput, 'admin'), (error) => statusOf(error) === 502);
});

test('registerService deletes the auth user when the profile cannot be created', async () => {
  signUp.mock.mockImplementation(async () => ({
    data: { user: supabaseUser('user-9'), session: supabaseSession },
    error: null,
  }));
  createProfileService.mock.mockImplementation(async () => {
    throw new Error('insert failed');
  });

  await assert.rejects(() => service.registerService(registerInput, 'admin'));
  assert.deepEqual(deleteUser.mock.calls[0].arguments, ['user-9']);
});

test('loginService throws 401 when the credentials are wrong', async () => {
  signInWithPassword.mock.mockImplementation(async () => ({
    data: { user: null, session: null },
    error: authError(400, 'invalid_credentials'),
  }));

  await assert.rejects(
    () => service.loginService({ email: 'lina@after.app', password: 'bad' }, 'admin'),
    (error) => statusOf(error) === 401,
  );
});

test('loginService throws 403 when a client account uses the admin login', async () => {
  signInWithPassword.mock.mockImplementation(async () => ({
    data: { user: supabaseUser(), session: supabaseSession },
    error: null,
  }));
  getProfileByIdService.mock.mockImplementation(async () => clientProfile);

  await assert.rejects(
    () => service.loginService({ email: 'lina@after.app', password: 'secret123' }, 'admin'),
    (error) => statusOf(error) === 403,
  );
});

test('loginService returns the admin profile and session', async () => {
  signInWithPassword.mock.mockImplementation(async () => ({
    data: { user: supabaseUser(), session: supabaseSession },
    error: null,
  }));
  getProfileByIdService.mock.mockImplementation(async () => adminProfile);

  const result = await service.loginService({ email: 'lina@after.app', password: 'secret123' }, 'admin');

  assert.equal(result.session?.accessToken, 'access-1');
});

test('refreshService throws 401 when the refresh token is invalid', async () => {
  refreshSession.mock.mockImplementation(async () => ({
    data: { session: null },
    error: authError(400, 'refresh_token_not_found'),
  }));

  await assert.rejects(() => service.refreshService('old'), (error) => statusOf(error) === 401);
});

test('refreshService returns the new session', async () => {
  refreshSession.mock.mockImplementation(async () => ({
    data: { session: { ...supabaseSession, access_token: 'access-2' } },
    error: null,
  }));

  const session = await service.refreshService('refresh-1');

  assert.equal(session.accessToken, 'access-2');
});
