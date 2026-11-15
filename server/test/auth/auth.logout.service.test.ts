import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { asyncMock, authError, statusOf } from '../helpers/supabaseMocks';

const signOut = asyncMock();

mock.module('../../src/lib/supabase', {
  namedExports: {
    createAuthClient: mock.fn(),
    getSupabase: () => ({ auth: { admin: { signOut } } }),
  },
});
mock.module('../../src/config', { namedExports: { ADMIN_SIGNUP_ENABLED: true } });
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { createProfileService: mock.fn(), getProfileByIdService: mock.fn() },
});

let service: typeof import('../../src/features/auth/auth.service');

before(async () => {
  service = await import('../../src/features/auth/auth.service');
  // The service logs Supabase failures on purpose; keep the test output clean
  mock.method(console, 'error', () => undefined);
});

beforeEach(() => {
  signOut.mock.resetCalls();
});

const messageOf = (error: unknown): string | undefined => (error as { message?: string }).message;

test('logoutService revokes the session of the given token with scope local', async () => {
  signOut.mock.mockImplementation(async () => ({ data: null, error: null }));

  await service.logoutService('access-1');

  assert.deepEqual(signOut.mock.calls[0].arguments, ['access-1', 'local']);
});

test('logoutService resolves when Supabase signs the session out', async () => {
  signOut.mock.mockImplementation(async () => ({ data: null, error: null }));

  await assert.doesNotReject(() => service.logoutService('access-1'));
});

test('logoutService throws 502 "Logout failed" when Supabase returns an error', async () => {
  signOut.mock.mockImplementation(async () => ({
    data: null,
    error: authError(500, 'unexpected_failure'),
  }));

  await assert.rejects(
    () => service.logoutService('access-1'),
    (error) => statusOf(error) === 502 && messageOf(error) === 'Logout failed',
  );
});

test('logoutService throws 502 "Logout failed" when the Supabase call throws', async () => {
  signOut.mock.mockImplementation(async () => {
    throw new Error('fetch failed');
  });

  await assert.rejects(
    () => service.logoutService('access-1'),
    (error) => statusOf(error) === 502 && messageOf(error) === 'Logout failed',
  );
});
