import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../middlewares/errorsMiddleware';
import { imageUploadMiddleware } from '../../middlewares/uploadMiddleware';
import { uploadImageController } from './upload.controller';

export const router = Router();

// Auth and role first so anonymous or client requests never get their body parsed
router.post(
  '/images',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  imageUploadMiddleware,
  asyncHandler(uploadImageController),
);
