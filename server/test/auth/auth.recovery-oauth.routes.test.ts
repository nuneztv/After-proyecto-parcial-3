import assert from 'node:assert/strict';
import { before, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';
import { testConfig } from '../helpers/configMock';

const getUser = asyncMock();

mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: { getSupabase: () => ({ auth: { getUser } }), createAuthClient: mock.fn() },
});

let app: Express;

before(async () => {
  const mod = await import('../../src/app');
  // CommonJS interop: the default export can arrive wrapped once more
  app = ((mod.default as unknown as { default?: Express }).default ?? mod.default) as Express;
});

test('POST /api/auth/forgot-password answers 400 for an invalid email', async () => {
  const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nope' });

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'A valid email is required');
});

test('POST /api/auth/reset-password answers 401 without the recovery token', async () => {
  const res = await request(app).post('/api/auth/reset-password').send({ password: 'newSecret123' });

  assert.equal(res.status, 401);
});

test('GET /api/auth/oauth/:provider answers 400 for an unsupported provider', async () => {
  const res = await request(app).get('/api/auth/oauth/facebook');

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Unsupported sign-in provider');
});

test('POST /api/auth/oauth/session answers 400 without tokens', async () => {
  const res = await request(app).post('/api/auth/oauth/session').send({ accessToken: 'x' });

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Sign-in tokens are required');
});

test('POST /api/auth/oauth/session answers 400 for an invalid expiry', async () => {
  const res = await request(app)
    .post('/api/auth/oauth/session')
    .send({ accessToken: 'x', refreshToken: 'y', expiresAt: 'soon' });

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Invalid session expiry');
});
