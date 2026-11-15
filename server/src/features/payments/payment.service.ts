import Boom from '@hapi/boom';
import { getProductByIdService } from '../products/product.service';
import {
  createPendingPaymentRepository,
  findActivePaymentForProductRepository,
  findPaymentByIdForUserRepository,
  findPaymentsByUserRepository,
} from './payment.repository';
import { Payment, ReservationResult } from './payment.types';

export const getPaymentsService = async (userId: string): Promise<Payment[]> =>
  findPaymentsByUserRepository(userId);

// Another user's payment answers 404, not 403: its existence is not revealed
export const getPaymentByIdService = async (id: string, userId: string): Promise<Payment> => {
  const payment = await findPaymentByIdForUserRepository(id, userId);

  if (!payment) {
    throw Boom.notFound('Payment not found');
  }

  return payment;
};

// "Get Ticket": a pending reservation, not a purchase. No payment gateway exists, so nothing here
// ever marks a payment as paid; the amount comes from the product row, not from the request
export const reserveTicketService = async (
  userId: string,
  productId: string,
  now: number = Date.now(),
): Promise<ReservationResult> => {
  const product = await getProductByIdService(productId);
  const { event } = product;

  if (event.status === 'closed') {
    throw Boom.conflict('This event is closed');
  }

  if (Date.parse(event.endsAt ?? event.startsAt) < now) {
    throw Boom.conflict('This event has already ended');
  }

  const createdId = await createPendingPaymentRepository(userId, productId);

  if (createdId) {
    return { payment: await getPaymentByIdService(createdId, userId), created: true };
  }

  // Reserved (or paid) before: the same request again returns that reservation
  const existing = await findActivePaymentForProductRepository(userId, productId);

  if (!existing) {
    // The product was deleted between the lookup and the insert
    throw Boom.notFound('Product not found');
  }

  return { payment: existing, created: false };
};
