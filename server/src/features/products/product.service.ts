import Boom from '@hapi/boom';
import { findProductByIdRepository, findProductsRepository } from './product.repository';
import { Product, ProductFilters } from './product.types';

export const getProductsService = async (filters: ProductFilters): Promise<Product[]> =>
  findProductsRepository(filters);

export const getProductByIdService = async (id: string): Promise<Product> => {
  const product = await findProductByIdRepository(id);

  if (!product) {
    throw Boom.notFound('Product not found');
  }

  return product;
};
