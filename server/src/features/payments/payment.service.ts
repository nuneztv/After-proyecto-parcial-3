import Boom from '@hapi/boom';
import {
  findPaymentByIdForUserRepository,
  findPaymentsByUserRepository,
} from './payment.repository';
import { Payment } from './payment.types';

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
