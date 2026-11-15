import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../middlewares/errorsMiddleware';
import {
  createEventController,
  getEventActivityController,
  getEventByIdController,
  getEventsController,
  getEventStatsController,
  getRecentActivityController,
  updateEventController,
  updateOccupancyController,
} from './event.controller';

export const router = Router();

// /stats and /activity are declared before /:id so they are not captured as ids
router.get('/', asyncHandler(authMiddleware), asyncHandler(getEventsController));
router.get(
  '/stats',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  asyncHandler(getEventStatsController),
);
router.get(
  '/activity',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  asyncHandler(getRecentActivityController),
);
router.get('/:id', asyncHandler(authMiddleware), asyncHandler(getEventByIdController));
router.get(
  '/:id/activity',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  asyncHandler(getEventActivityController),
);
router.post(
  '/',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  asyncHandler(createEventController),
);
router.patch(
  '/:id',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  asyncHandler(updateEventController),
);
router.patch(
  '/:id/occupancy',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  asyncHandler(updateOccupancyController),
);
