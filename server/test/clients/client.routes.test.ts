import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';
import { testConfig } from '../helpers/configMock';

const getUser = asyncMock();
const getProfileRoleService = asyncMock();

mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: {
    getSupabase: () => ({ auth: { getUser } }),
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

  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-1', email: 'lina@after.app' } },
    error: null,
  }));
});

beforeEach(() => {
  getProfileRoleService.mock.mockImplementation(async () => 'admin');
});

const asRole = (role: string) => {
  getProfileRoleService.mock.mockImplementation(async () => role);
};

for (const path of ['/api/clients', '/api/clients/cli-1']) {
  test(`GET ${path} answers 401 without a token`, async () => {
    const res = await request(app).get(path);

    assert.equal(res.status, 401);
  });

  test(`GET ${path} answers 403 to a client account`, async () => {
    asRole('client');

    const res = await request(app).get(path).set('Authorization', 'Bearer access-1');

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'Administrators only');
  });
}

test('GET /api/clients lists profiles without passwords for an admin', async () => {
  const res = await request(app).get('/api/clients').set('Authorization', 'Bearer access-1');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body) && res.body.length > 0);
  assert.ok(res.body.every((item: Record<string, unknown>) => !('password' in item)));
});

test('GET /api/clients/:id answers 200 for an admin', async () => {
  const res = await request(app).get('/api/clients/cli-1').set('Authorization', 'Bearer access-1');

  assert.equal(res.status, 200);
  assert.equal(res.body.id, 'cli-1');
});
