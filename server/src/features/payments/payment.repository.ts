import { pool } from '../../db/db';
import { EVENT_SUMMARY_JSON, isoTimestamp } from '../../shared/sql';
import { Payment } from './payment.types';

// Payment + its product + the product's event, in one query (no request per row)
const PAYMENT_COLUMNS = `
  pay.id, pay.product_id AS "productId", pay.amount, pay.currency, pay.status,
  ${isoTimestamp('pay.created_at')} AS "createdAt",
  json_build_object(
    'id', p.id, 'name', p.name, 'category', p.category, 'imageUrl', p.image_url,
    'event', ${EVENT_SUMMARY_JSON}
  ) AS product`;

const PAYMENT_JOINS = `
  FROM public.payments pay
  JOIN public.products p ON p.id = pay.product_id
  JOIN public.events e ON e.id = p.event_id`;

// Every query is scoped by user_id: a user only ever sees their own payments
export const findPaymentsByUserRepository = async (userId: string): Promise<Payment[]> => {
  const result = await pool.query<Payment>(
    `SELECT ${PAYMENT_COLUMNS} ${PAYMENT_JOINS}
     WHERE pay.user_id = $1
     ORDER BY pay.created_at DESC, pay.id ASC`,
    [userId],
  );

  return result.rows;
};

export const findPaymentByIdForUserRepository = async (
  id: string,
  userId: string,
): Promise<Payment | undefined> => {
  const result = await pool.query<Payment>(
    `SELECT ${PAYMENT_COLUMNS} ${PAYMENT_JOINS}
     WHERE pay.id = $1 AND pay.user_id = $2`,
    [id, userId],
  );

  return result.rows[0];
};

// Creates a pending reservation priced from the product row (never from the request). Returns
// null when the user already holds a pending or paid one for this ticket (partial unique index)
export const createPendingPaymentRepository = async (
  userId: string,
  productId: string,
): Promise<string | null> => {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO public.payments (user_id, product_id, amount, currency, status)
     SELECT $1, p.id, p.price, p.currency, 'pending' FROM public.products p WHERE p.id = $2
     ON CONFLICT (user_id, product_id) WHERE status IN ('pending', 'paid') DO NOTHING
     RETURNING id`,
    [userId, productId],
  );

  return result.rows[0]?.id ?? null;
};

// The pending or paid payment the user already has for a ticket, if any
export const findActivePaymentForProductRepository = async (
  userId: string,
  productId: string,
): Promise<Payment | undefined> => {
  const result = await pool.query<Payment>(
    `SELECT ${PAYMENT_COLUMNS} ${PAYMENT_JOINS}
     WHERE pay.user_id = $1 AND pay.product_id = $2 AND pay.status IN ('pending', 'paid')`,
    [userId, productId],
  );

  return result.rows[0];
};
