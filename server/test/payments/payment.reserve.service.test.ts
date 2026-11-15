import assert from 'node:assert/strict';
import Boom from '@hapi/boom';
import { before, beforeEach, mock, test } from 'node:test';
import { asyncMock, statusOf } from '../helpers/supabaseMocks';

const getProductByIdService = asyncMock();
const createPendingPaymentRepository = asyncMock();
const findActivePaymentForProductRepository = asyncMock();
const findPaymentByIdForUserRepository = asyncMock();

mock.module('../../src/features/products/product.service', {
  namedExports: { getProductByIdService, getProductsService: mock.fn() },
});
mock.module('../../src/features/payments/payment.repository', {
  namedExports: {
    createPendingPaymentRepository,
    findActivePaymentForProductRepository,
    findPaymentByIdForUserRepository,
    findPaymentsByUserRepository: mock.fn(),
  },
});

let service: typeof import('../../src/features/payments/payment.service');

before(async () => {
  service = await import('../../src/features/payments/payment.service');
});

const USER_ID = 'user-1';
const PRODUCT_ID = 'b0000000-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-11-14T20:00:00.000Z');

const product = (event: Record<string, unknown> = {}) => ({
  id: PRODUCT_ID,
  eventId: 'e0000000-0000-4000-8000-000000000001',
  name: 'Rooftop Sessions',
  category: 'ticket',
  price: 45000,
  currency: 'COP',
  description: '',
  imageUrl: null,
  event: {
    id: 'e0000000-0000-4000-8000-000000000001',
    title: 'Rooftop Sessions',
    venueName: 'Skyline Rooftop',
    address: 'Cra 8a #22-26, Cali',
    status: 'open',
    imageUrl: null,
    startsAt: '2026-11-14T23:00:00.000Z',
    endsAt: '2026-11-15T07:00:00.000Z',
    ...event,
  },
});

const pending = { id: 'c0000000-0000-4000-8000-000000000001', status: 'pending', amount: 45000 };

beforeEach(() => {
  [
    getProductByIdService,
    createPendingPaymentRepository,
    findActivePaymentForProductRepository,
    findPaymentByIdForUserRepository,
  ].forEach((fn) => fn.mock.resetCalls());
  getProductByIdService.mock.mockImplementation(async () => product());
  createPendingPaymentRepository.mock.mockImplementation(async () => pending.id);
  findPaymentByIdForUserRepository.mock.mockImplementation(async () => pending);
  findActivePaymentForProductRepository.mock.mockImplementation(async () => pending);
});

test('reserveTicketService creates a pending reservation for the user', async () => {
  const result = await service.reserveTicketService(USER_ID, PRODUCT_ID, NOW);

  assert.deepEqual(result, { payment: pending, created: true });
  assert.deepEqual(createPendingPaymentRepository.mock.calls[0].arguments, [USER_ID, PRODUCT_ID]);
  assert.deepEqual(findPaymentByIdForUserRepository.mock.calls[0].arguments, [pending.id, USER_ID]);
});

test('reserveTicketService returns the existing reservation instead of a second one', async () => {
  createPendingPaymentRepository.mock.mockImplementation(async () => null);

  const result = await service.reserveTicketService(USER_ID, PRODUCT_ID, NOW);

  assert.deepEqual(result, { payment: pending, created: false });
  assert.deepEqual(findActivePaymentForProductRepository.mock.calls[0].arguments, [USER_ID, PRODUCT_ID]);
});

test('reserveTicketService answers 404 for a missing product and creates nothing', async () => {
  getProductByIdService.mock.mockImplementation(async () => {
    throw Boom.notFound('Product not found');
  });

  await assert.rejects(service.reserveTicketService(USER_ID, PRODUCT_ID, NOW), (error) => statusOf(error) === 404);
  assert.equal(createPendingPaymentRepository.mock.callCount(), 0);
});

test('reserveTicketService answers 409 for a closed event', async () => {
  getProductByIdService.mock.mockImplementation(async () => product({ status: 'closed' }));

  await assert.rejects(service.reserveTicketService(USER_ID, PRODUCT_ID, NOW), /This event is closed/);
  assert.equal(createPendingPaymentRepository.mock.callCount(), 0);
});

test('reserveTicketService answers 409 for an event that already ended', async () => {
  getProductByIdService.mock.mockImplementation(async () =>
    product({ startsAt: '2026-11-10T23:00:00.000Z', endsAt: '2026-11-11T05:00:00.000Z' }),
  );

  await assert.rejects(service.reserveTicketService(USER_ID, PRODUCT_ID, NOW), /already ended/);
  assert.equal(createPendingPaymentRepository.mock.callCount(), 0);
});

test('reserveTicketService treats an event without end time as ended once it started', async () => {
  getProductByIdService.mock.mockImplementation(async () =>
    product({ startsAt: '2026-11-14T19:00:00.000Z', endsAt: null }),
  );

  await assert.rejects(service.reserveTicketService(USER_ID, PRODUCT_ID, NOW), (error) => statusOf(error) === 409);
});
