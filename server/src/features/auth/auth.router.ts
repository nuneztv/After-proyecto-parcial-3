import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../middlewares/errorsMiddleware';
import {
  createOAuthSessionController,
  forgotPasswordController,
  getMeController,
  getOAuthUrlController,
  loginAdminController,
  loginController,
  logoutController,
  refreshController,
  registerAdminController,
  registerController,
  resetPasswordController,
} from './auth.controller';

export const router = Router();

router.post('/register', asyncHandler(registerController));
router.post('/login', asyncHandler(loginController));
router.post('/admin/register', asyncHandler(registerAdminController));
router.post('/admin/login', asyncHandler(loginAdminController));
router.post('/refresh', asyncHandler(refreshController));
router.post('/logout', asyncHandler(authMiddleware), asyncHandler(logoutController));
router.get('/me', asyncHandler(authMiddleware), asyncHandler(getMeController));
router.post('/forgot-password', asyncHandler(forgotPasswordController));
router.post('/reset-password', asyncHandler(authMiddleware), asyncHandler(resetPasswordController));
router.get('/oauth/:provider', asyncHandler(getOAuthUrlController));
router.post('/oauth/session', asyncHandler(createOAuthSessionController));
