import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';

// Validation and missing-auth failures happen before any Supabase or database call,
// so the real app can be used without mocks.
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

test('GET /api/products keeps working without Supabase', async () => {
  const res = await request(app).get('/api/products');

  assert.equal(res.status, 200);
});
