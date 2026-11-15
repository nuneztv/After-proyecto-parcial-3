import assert from 'node:assert/strict';
import { before, mock, test } from 'node:test';
import express, { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';

const getUser = asyncMock();
const getProfileRoleService = asyncMock();

mock.module('../../src/lib/supabase', {
  namedExports: { getSupabase: () => ({ auth: { getUser } }), createAuthClient: mock.fn() },
});
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { getProfileRoleService },
});

let app: Express;

before(async () => {
  const { authMiddleware, requireRole } = await import('../../src/middlewares/authMiddleware');
  const { asyncHandler, errorsMiddleware } = await import('../../src/middlewares/errorsMiddleware');

  app = express();
  app.get('/admin-only', asyncHandler(authMiddleware), requireRole('admin'), (req, res) => {
    res.json(req.user);
  });
  app.use(errorsMiddleware);
});

test('authMiddleware answers 401 without an Authorization header', async () => {
  const res = await request(app).get('/admin-only');

  assert.equal(res.status, 401);
});

test('authMiddleware answers 401 for a non-Bearer scheme', async () => {
  const res = await request(app).get('/admin-only').set('Authorization', 'Basic abc');

  assert.equal(res.status, 401);
});

test('authMiddleware answers 401 when Supabase rejects the token', async () => {
  getUser.mock.mockImplementation(async () => ({ data: { user: null }, error: { message: 'expired' } }));

  const res = await request(app).get('/admin-only').set('Authorization', 'Bearer expired');

  assert.equal(res.status, 401);
});

test('requireRole answers 403 for a client account', async () => {
  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-2', email: 'ana@after.app' } },
    error: null,
  }));
  getProfileRoleService.mock.mockImplementation(async () => 'client');

  const res = await request(app).get('/admin-only').set('Authorization', 'Bearer valid');

  assert.equal(res.status, 403);
});

test('an admin token reaches the handler with req.user set', async () => {
  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-1', email: 'lina@after.app' } },
    error: null,
  }));
  getProfileRoleService.mock.mockImplementation(async () => 'admin');

  const res = await request(app).get('/admin-only').set('Authorization', 'Bearer valid');

  assert.deepEqual(res.body, { id: 'user-1', email: 'lina@after.app', role: 'admin' });
});
