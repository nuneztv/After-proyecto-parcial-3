import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../middlewares/errorsMiddleware';
import { getPaymentByIdController, getPaymentsController } from './payment.controller';

export const router = Router();

router.get('/', asyncHandler(authMiddleware), asyncHandler(getPaymentsController));
router.get('/:id', asyncHandler(authMiddleware), asyncHandler(getPaymentByIdController));
