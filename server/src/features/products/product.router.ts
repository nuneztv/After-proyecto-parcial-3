import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../middlewares/errorsMiddleware';
import { getProductByIdController, getProductsController } from './product.controller';

export const router = Router();

router.get('/', asyncHandler(authMiddleware), asyncHandler(getProductsController));
router.get('/:id', asyncHandler(authMiddleware), asyncHandler(getProductByIdController));
