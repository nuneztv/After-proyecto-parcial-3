import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';
import { testConfig } from '../helpers/configMock';
import { EVENT_ID } from '../helpers/eventFixtures';

const getUser = asyncMock();
const getProfileRoleService = asyncMock();
const findProductsRepository = asyncMock();
const findProductByIdRepository = asyncMock();

mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: { getSupabase: () => ({ auth: { getUser } }), createAuthClient: mock.fn() },
});
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { getProfileRoleService },
});
// The real service runs; only the database is replaced
mock.module('../../src/features/products/product.repository', {
  namedExports: { findProductsRepository, findProductByIdRepository },
});

const PRODUCT_ID = 'b0000000-0000-4000-8000-000000000001';
const MISSING_PRODUCT_ID = 'b0000000-0000-4000-8000-000000000099';
const ticket = {
  id: PRODUCT_ID,
  eventId: EVENT_ID,
  name: 'Rooftop Sessions',
  category: 'ticket',
  price: 45000,
  currency: 'COP',
  description: 'Sunset rooftop party in Cali.',
  imageUrl: '/images/events/rooftop-sessions.jpg',
  event: {
    id: EVENT_ID,
    title: 'Rooftop Sessions',
    venueName: 'Skyline Rooftop',
    address: 'Cra 8a #22-26, Cali',
    status: 'live',
    imageUrl: '/images/events/rooftop-sessions.jpg',
    startsAt: '2026-11-14T23:00:00.000Z',
    endsAt: '2026-11-15T07:00:00.000Z',
  },
};

let app: Express;

before(async () => {
  const mod = await import('../../src/app');
  // CommonJS interop: the default export can arrive wrapped once more
  app = ((mod.default as unknown as { default?: Express }).default ?? mod.default) as Express;

  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-1', email: 'lina@after.app' } },
    error: null,
  }));
  getProfileRoleService.mock.mockImplementation(async () => 'client');
});

beforeEach(() => {
  findProductsRepository.mock.resetCalls();
  findProductsRepository.mock.mockImplementation(async () => [ticket]);
  findProductByIdRepository.mock.mockImplementation(async (id: unknown) =>
    id === PRODUCT_ID ? ticket : undefined,
  );
});

const auth = { Authorization: 'Bearer access-1' };

test('product routes answer 401 without a token', async () => {
  const responses = await Promise.all([
    request(app).get('/api/products'),
    request(app).get(`/api/products/${PRODUCT_ID}`),
  ]);

  assert.deepEqual(responses.map((res) => res.status), [401, 401]);
});

test('GET /api/products returns tickets with their event nested', async () => {
  const res = await request(app).get('/api/products').set(auth);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [ticket]);
  assert.deepEqual(findProductsRepository.mock.calls[0].arguments, [{ eventId: null }]);
});

test('GET /api/products?eventId= filters by event', async () => {
  await request(app).get(`/api/products?eventId=${EVENT_ID}`).set(auth);

  assert.deepEqual(findProductsRepository.mock.calls[0].arguments, [{ eventId: EVENT_ID }]);
});

test('GET /api/products answers 400 for an invalid eventId', async () => {
  const res = await request(app).get('/api/products?eventId=evt-1').set(auth);

  assert.equal(res.status, 400);
  assert.equal(findProductsRepository.mock.callCount(), 0);
});

test('GET /api/products/:id returns the ticket', async () => {
  const res = await request(app).get(`/api/products/${PRODUCT_ID}`).set(auth);

  assert.equal(res.status, 200);
  assert.equal(res.body.event.venueName, 'Skyline Rooftop');
});

test('GET /api/products/:id answers 404 for a missing ticket', async () => {
  const res = await request(app).get(`/api/products/${MISSING_PRODUCT_ID}`).set(auth);

  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'Product not found');
});

test('GET /api/products/:id answers 400 for an invalid id', async () => {
  const res = await request(app).get('/api/products/prod-1').set(auth);

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Invalid product id');
});
