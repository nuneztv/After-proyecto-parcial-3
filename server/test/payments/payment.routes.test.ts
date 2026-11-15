import assert from 'node:assert/strict';
import { before, beforeEach, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';
import { testConfig } from '../helpers/configMock';
import { EVENT_ID } from '../helpers/eventFixtures';

const getUser = asyncMock();
const getProfileRoleService = asyncMock();
const findPaymentsByUserRepository = asyncMock();
const findPaymentByIdForUserRepository = asyncMock();

mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: { getSupabase: () => ({ auth: { getUser } }), createAuthClient: mock.fn() },
});
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { getProfileRoleService },
});
// The real service runs; only the database is replaced
mock.module('../../src/features/payments/payment.repository', {
  namedExports: { findPaymentsByUserRepository, findPaymentByIdForUserRepository },
});

const USER_ID = 'user-1';
const PAYMENT_ID = 'c0000000-0000-4000-8000-000000000001';
const OTHER_USERS_PAYMENT_ID = 'c0000000-0000-4000-8000-000000000002';
const payment = {
  id: PAYMENT_ID,
  productId: 'b0000000-0000-4000-8000-000000000001',
  amount: 45000,
  currency: 'COP',
  status: 'paid',
  createdAt: '2026-11-14T20:00:00.000Z',
  product: {
    id: 'b0000000-0000-4000-8000-000000000001',
    name: 'Rooftop Sessions',
    category: 'ticket',
    imageUrl: '/images/events/rooftop-sessions.jpg',
    event: {
      id: EVENT_ID,
      title: 'Rooftop Sessions',
      venueName: 'Skyline Rooftop',
      address: 'Cra 8a #22-26, Cali',
      status: 'live',
      imageUrl: '/images/events/rooftop-sessions.jpg',
      startsAt: '2026-11-14T23:00:00.000Z',
      endsAt: null,
    },
  },
};

let app: Express;

before(async () => {
  const mod = await import('../../src/app');
  // CommonJS interop: the default export can arrive wrapped once more
  app = ((mod.default as unknown as { default?: Express }).default ?? mod.default) as Express;

  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: USER_ID, email: 'lina@after.app' } },
    error: null,
  }));
  getProfileRoleService.mock.mockImplementation(async () => 'client');
});

beforeEach(() => {
  findPaymentsByUserRepository.mock.resetCalls();
  findPaymentByIdForUserRepository.mock.resetCalls();
  findPaymentsByUserRepository.mock.mockImplementation(async () => [payment]);
  // Only PAYMENT_ID belongs to USER_ID
  findPaymentByIdForUserRepository.mock.mockImplementation(async (id: unknown, userId: unknown) =>
    id === PAYMENT_ID && userId === USER_ID ? payment : undefined,
  );
});

const auth = { Authorization: 'Bearer access-1' };

test('payment routes answer 401 without a token', async () => {
  const responses = await Promise.all([
    request(app).get('/api/payments'),
    request(app).get(`/api/payments/${PAYMENT_ID}`),
  ]);

  assert.deepEqual(responses.map((res) => res.status), [401, 401]);
});

test('GET /api/payments returns only the token user payments, with product and event nested', async () => {
  const res = await request(app).get('/api/payments').set(auth);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [payment]);
  assert.deepEqual(findPaymentsByUserRepository.mock.calls[0].arguments, [USER_ID]);
});

test('GET /api/payments ignores a user id sent in the query', async () => {
  await request(app).get('/api/payments?userId=someone-else').set(auth);

  assert.deepEqual(findPaymentsByUserRepository.mock.calls[0].arguments, [USER_ID]);
});

test('GET /api/payments/:id returns an own payment', async () => {
  const res = await request(app).get(`/api/payments/${PAYMENT_ID}`).set(auth);

  assert.equal(res.status, 200);
  assert.equal(res.body.product.event.title, 'Rooftop Sessions');
});

test("GET /api/payments/:id answers 404 for another user's payment", async () => {
  const res = await request(app).get(`/api/payments/${OTHER_USERS_PAYMENT_ID}`).set(auth);

  assert.equal(res.status, 404);
  assert.deepEqual(findPaymentByIdForUserRepository.mock.calls[0].arguments, [
    OTHER_USERS_PAYMENT_ID,
    USER_ID,
  ]);
});

test('GET /api/payments/:id answers 400 for an invalid id', async () => {
  const res = await request(app).get('/api/payments/pay-1').set(auth);

  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'Invalid payment id');
});
