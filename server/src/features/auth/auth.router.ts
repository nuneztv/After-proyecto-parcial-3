import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../middlewares/errorsMiddleware';
import {
  getMeController,
  loginAdminController,
  loginController,
  refreshController,
  registerAdminController,
  registerController,
} from './auth.controller';

export const router = Router();

router.post('/register', asyncHandler(registerController));
router.post('/login', asyncHandler(loginController));
router.post('/admin/register', asyncHandler(registerAdminController));
router.post('/admin/login', asyncHandler(loginAdminController));
router.post('/refresh', asyncHandler(refreshController));
router.get('/me', asyncHandler(authMiddleware), asyncHandler(getMeController));
