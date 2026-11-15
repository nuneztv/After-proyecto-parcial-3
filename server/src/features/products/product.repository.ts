import { pool } from '../../db/db';
import { EVENT_SUMMARY_JSON } from '../../shared/sql';
import { Product, ProductFilters } from './product.types';

const PRODUCT_COLUMNS = `
  p.id, p.event_id AS "eventId", p.name, p.category, p.price, p.currency, p.description,
  p.image_url AS "imageUrl", ${EVENT_SUMMARY_JSON} AS event`;

export const findProductsRepository = async (filters: ProductFilters): Promise<Product[]> => {
  const result = await pool.query<Product>(
    `SELECT ${PRODUCT_COLUMNS}
     FROM public.products p
     JOIN public.events e ON e.id = p.event_id
     WHERE ($1::uuid IS NULL OR p.event_id = $1::uuid)
     ORDER BY e.starts_at ASC, p.name ASC`,
    [filters.eventId],
  );

  return result.rows;
};

export const findProductByIdRepository = async (id: string): Promise<Product | undefined> => {
  const result = await pool.query<Product>(
    `SELECT ${PRODUCT_COLUMNS}
     FROM public.products p
     JOIN public.events e ON e.id = p.event_id
     WHERE p.id = $1`,
    [id],
  );

  return result.rows[0];
};
