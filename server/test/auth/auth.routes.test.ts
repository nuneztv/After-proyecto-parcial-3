import assert from 'node:assert/strict';
import { before, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';

// Validation and missing-auth failures happen before any Supabase or database call.
// Supabase and Realtime are still replaced by guards, so a request that reached them by
// mistake fails the test instead of calling the real project that dotenv configures.
const unexpectedSupabaseCall = (): never => {
  throw new Error('Supabase must not be called in auth route tests');
};

mock.module('../../src/lib/supabase', {
  namedExports: { getSupabase: unexpectedSupabaseCall, createAuthClient: unexpectedSupabaseCall },
});
mock.module('../../src/lib/realtime', {
  namedExports: {
    broadcast: unexpectedSupabaseCall,
    EVENTS_CHANNEL: 'events',
    REALTIME_EVENTS: {
      eventCreated: 'event-created',
      eventUpdated: 'event-updated',
      activityCreated: 'activity-created',
    },
  },
});

let app: Express;

before(async () => {
  const mod = await import('../../src/app');
  // CommonJS interop: the default export can arrive wrapped once more
  app = ((mod.default as unknown as { default?: Express }).default ?? mod.default) as Express;
});

test('POST /api/auth/admin/login answers 400 without an email', async () => {
  const res = await request(app).post('/api/auth/admin/login').send({ password: 'secret123' });

  assert.equal(res.status, 400);
});

test('POST /api/auth/admin/login answers 400 without a password', async () => {
  const res = await request(app).post('/api/auth/admin/login').send({ email: 'lina@after.app' });

  assert.equal(res.status, 400);
});

test('POST /api/auth/admin/register answers 400 for a short password', async () => {
  const res = await request(app)
    .post('/api/auth/admin/register')
    .send({ email: 'lina@after.app', password: 'short', fullName: 'Lina' });

  assert.equal(res.body.message, 'Password must be at least 8 characters');
});

test('POST /api/auth/admin/register answers 400 without a full name', async () => {
  const res = await request(app)
    .post('/api/auth/admin/register')
    .send({ email: 'lina@after.app', password: 'secret123', fullName: '  ' });

  assert.equal(res.body.message, 'Full name is required');
});

test('POST /api/auth/refresh answers 400 without a refresh token', async () => {
  const res = await request(app).post('/api/auth/refresh').send({});

  assert.equal(res.status, 400);
});

test('GET /api/auth/me answers 401 without a token', async () => {
  const res = await request(app).get('/api/auth/me');

  assert.equal(res.status, 401);
});

// Products are no longer a public mock (they need a token and the database): the app itself
// must still answer without Supabase configured
test('GET / keeps working without Supabase', async () => {
  const res = await request(app).get('/');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { name: 'After API' });
});

test('GET /api/products answers 401 without a token', async () => {
  const res = await request(app).get('/api/products');

  assert.equal(res.status, 401);
});
