import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock, authError } from '../helpers/supabaseMocks';
import { testConfig } from '../helpers/configMock';

const getUser = asyncMock();
const signOut = asyncMock();
const getProfileRoleService = asyncMock();

mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: {
    getSupabase: () => ({ auth: { getUser, admin: { signOut } } }),
    createAuthClient: mock.fn(),
  },
});
mock.module('../../src/features/profiles/profile.service', {
  namedExports: {
    getProfileRoleService,
    createProfileService: mock.fn(),
    getProfileByIdService: mock.fn(),
  },
});

let app: Express;

before(async () => {
  const mod = await import('../../src/app');
  // CommonJS interop: the default export can arrive wrapped once more
  app = ((mod.default as unknown as { default?: Express }).default ?? mod.default) as Express;
  // The service logs Supabase failures on purpose; keep the test output clean
  mock.method(console, 'error', () => undefined);

  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-1', email: 'lina@after.app' } },
    error: null,
  }));
  getProfileRoleService.mock.mockImplementation(async () => 'admin');
});

beforeEach(() => {
  signOut.mock.resetCalls();
  signOut.mock.mockImplementation(async () => ({ data: null, error: null }));
});

const logout = () =>
  request(app).post('/api/auth/logout').set('Authorization', 'Bearer access-1');

test('POST /api/auth/logout answers 401 without a token', async () => {
  const res = await request(app).post('/api/auth/logout');

  assert.equal(res.status, 401);
});

test('POST /api/auth/logout does not call signOut without a token', async () => {
  await request(app).post('/api/auth/logout');

  assert.equal(signOut.mock.callCount(), 0);
});

test('POST /api/auth/logout answers 401 and does not call signOut for an invalid or expired token', async () => {
  getUser.mock.mockImplementationOnce(async () => ({
    data: { user: null },
    error: { message: 'invalid JWT' },
  }));

  const res = await logout();

  assert.deepEqual([res.status, signOut.mock.callCount()], [401, 0]);
});

test('POST /api/auth/logout answers 204 with an empty body for a valid token', async () => {
  const res = await logout();

  assert.deepEqual([res.status, res.text], [204, '']);
});

test('POST /api/auth/logout revokes the session of the request token with scope local', async () => {
  await logout();

  assert.deepEqual(signOut.mock.calls[0].arguments, ['access-1', 'local']);
});

test('POST /api/auth/logout answers 204 for a client token too', async () => {
  getProfileRoleService.mock.mockImplementationOnce(async () => 'client');

  const res = await logout();

  assert.equal(res.status, 204);
});

test('POST /api/auth/logout answers 502 "Logout failed" when Supabase returns an error', async () => {
  signOut.mock.mockImplementation(async () => ({
    data: null,
    error: authError(500, 'unexpected_failure'),
  }));

  const res = await logout();

  assert.deepEqual([res.status, res.body.message], [502, 'Logout failed']);
});
