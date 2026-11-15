import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../middlewares/errorsMiddleware';
import {
  getSavedEventsController,
  saveEventController,
  unsaveEventController,
} from './savedEvent.controller';

export const router = Router();

// PUT, not POST: saving is idempotent (the same request twice leaves one favorite)
router.get('/', asyncHandler(authMiddleware), asyncHandler(getSavedEventsController));
router.put('/:eventId', asyncHandler(authMiddleware), asyncHandler(saveEventController));
router.delete('/:eventId', asyncHandler(authMiddleware), asyncHandler(unsaveEventController));
