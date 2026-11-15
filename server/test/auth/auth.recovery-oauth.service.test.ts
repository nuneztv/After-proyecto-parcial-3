import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { asyncMock, authError, clientProfile, statusOf } from '../helpers/supabaseMocks';

const resetPasswordForEmail = asyncMock();
const signInWithOAuth = asyncMock();
const getUser = asyncMock();
const updateUserById = asyncMock();
const signOut = asyncMock();
const ensureProfileService = asyncMock();
const fetchMock = mock.fn(async (..._args: unknown[]): Promise<unknown> => undefined);

mock.module('../../src/lib/supabase', {
  namedExports: {
    createAuthClient: () => ({ auth: { resetPasswordForEmail, signInWithOAuth } }),
    getSupabase: () => ({ auth: { getUser, admin: { updateUserById, signOut } } }),
  },
});
mock.module('../../src/config', {
  namedExports: {
    ADMIN_SIGNUP_ENABLED: true,
    CLIENT_URL: 'http://localhost:3001',
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SECRET_KEY: 'test-secret-key',
  },
});
mock.module('../../src/features/profiles/profile.service', {
  namedExports: {
    createProfileService: mock.fn(),
    getProfileByIdService: mock.fn(),
    ensureProfileService,
  },
});

let service: typeof import('../../src/features/auth/auth.service');

before(async () => {
  service = await import('../../src/features/auth/auth.service');
  mock.method(globalThis, 'fetch', fetchMock);
  // The services log rejected Supabase calls on purpose
  mock.method(console, 'error', () => undefined);
});

beforeEach(() => {
  [resetPasswordForEmail, signInWithOAuth, getUser, updateUserById, signOut, ensureProfileService, fetchMock]
    .forEach((fn) => fn.mock.resetCalls());
  resetPasswordForEmail.mock.mockImplementation(async () => ({ data: {}, error: null }));
  updateUserById.mock.mockImplementation(async () => ({ data: {}, error: null }));
  signOut.mock.mockImplementation(async () => ({ error: null }));
  fetchMock.mock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ external: { google: true, apple: false } }),
  }));
  signInWithOAuth.mock.mockImplementation(async () => ({
    data: { url: 'https://test-project.supabase.co/auth/v1/authorize?provider=google' },
    error: null,
  }));
});

const rejects = async (promise: Promise<unknown>, status: number) => {
  await assert.rejects(promise, (error) => statusOf(error) === status);
};

test('requestPasswordResetService sends the email with the /reset-password redirect', async () => {
  await service.requestPasswordResetService('lina@after.app');

  assert.deepEqual(resetPasswordForEmail.mock.calls[0].arguments, [
    'lina@after.app',
    { redirectTo: 'http://localhost:3001/reset-password' },
  ]);
});

test('requestPasswordResetService does not reveal a rejected (e.g. unknown) email', async () => {
  resetPasswordForEmail.mock.mockImplementation(async () => ({
    data: null,
    error: authError(400, 'validation_failed'),
  }));

  await service.requestPasswordResetService('nobody@after.app');
});

test('requestPasswordResetService answers 429 when Supabase rate-limits the emails', async () => {
  resetPasswordForEmail.mock.mockImplementation(async () => ({
    data: null,
    error: authError(429, 'over_email_send_rate_limit'),
  }));

  await rejects(service.requestPasswordResetService('lina@after.app'), 429);
});

test('requestPasswordResetService answers 502 when Supabase fails', async () => {
  resetPasswordForEmail.mock.mockImplementation(async () => ({
    data: null,
    error: authError(500, 'unexpected_failure'),
  }));

  await rejects(service.requestPasswordResetService('lina@after.app'), 502);
});

test('resetPasswordService updates the password and ends the recovery session', async () => {
  await service.resetPasswordService('user-1', 'recovery-token', 'newSecret123');

  assert.deepEqual(updateUserById.mock.calls[0].arguments, ['user-1', { password: 'newSecret123' }]);
  assert.deepEqual(signOut.mock.calls[0].arguments, ['recovery-token', 'local']);
});

test('resetPasswordService answers 400 with the Supabase reason', async () => {
  updateUserById.mock.mockImplementation(async () => ({
    data: null,
    error: authError(422, 'same_password', 'New password should be different from the old password.'),
  }));

  await assert.rejects(
    service.resetPasswordService('user-1', 'recovery-token', 'oldSecret123'),
    /New password should be different/,
  );
  assert.equal(signOut.mock.callCount(), 0);
});

test('resetPasswordService still succeeds if ending the recovery session fails', async () => {
  signOut.mock.mockImplementation(async () => ({ error: authError(500, 'unexpected_failure') }));

  await service.resetPasswordService('user-1', 'recovery-token', 'newSecret123');

  assert.equal(updateUserById.mock.callCount(), 1);
});

test('getOAuthUrlService returns the provider URL with the /auth/callback redirect', async () => {
  const url = await service.getOAuthUrlService('google');

  assert.equal(url, 'https://test-project.supabase.co/auth/v1/authorize?provider=google');
  assert.deepEqual(signInWithOAuth.mock.calls[0].arguments, [
    {
      provider: 'google',
      options: { redirectTo: 'http://localhost:3001/auth/callback', skipBrowserRedirect: true },
    },
  ]);
});

test('getOAuthUrlService answers 503 when the provider is not enabled in Supabase', async () => {
  await assert.rejects(service.getOAuthUrlService('apple'), (error) => {
    assert.equal(statusOf(error), 503);
    assert.match((error as Error).message, /Apple sign-in is not enabled yet/);
    return true;
  });
  assert.equal(signInWithOAuth.mock.callCount(), 0);
});

test('getOAuthUrlService answers 502 when the Supabase settings cannot be read', async () => {
  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }));

  await rejects(service.getOAuthUrlService('google'), 502);
});

const oauthTokens = { accessToken: 'oauth-access', refreshToken: 'oauth-refresh', expiresAt: 1900000000 };

test('createOAuthSessionService validates the token and returns the profile with the session', async () => {
  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-1', email: 'lina@after.app', user_metadata: { full_name: 'Lina Sanchez' } } },
    error: null,
  }));
  ensureProfileService.mock.mockImplementation(async () => clientProfile);

  const result = await service.createOAuthSessionService(oauthTokens);

  assert.deepEqual(result, { user: clientProfile, session: oauthTokens });
  assert.deepEqual(getUser.mock.calls[0].arguments, ['oauth-access']);
  assert.deepEqual(ensureProfileService.mock.calls[0].arguments, [
    { id: 'user-1', email: 'lina@after.app', fullName: 'Lina Sanchez' },
  ]);
});

test('createOAuthSessionService names a profile without metadata after the email', async () => {
  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-2', email: 'ana.ruiz@after.app', user_metadata: {} } },
    error: null,
  }));
  ensureProfileService.mock.mockImplementation(async () => clientProfile);

  await service.createOAuthSessionService(oauthTokens);

  assert.equal((ensureProfileService.mock.calls[0].arguments[0] as { fullName: string }).fullName, 'ana.ruiz');
});

test('createOAuthSessionService answers 401 for an invalid token and creates no profile', async () => {
  getUser.mock.mockImplementation(async () => ({ data: { user: null }, error: authError(401, 'bad_jwt') }));

  await rejects(service.createOAuthSessionService(oauthTokens), 401);
  assert.equal(ensureProfileService.mock.callCount(), 0);
});
