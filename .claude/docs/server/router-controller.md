# Router and controller

This server runs **Express 4**: a rejected promise is NOT forwarded to the error middleware automatically. Every async handler is wrapped with `asyncHandler` from `middlewares/errorsMiddleware.ts`.

## Router

```ts
import { Router } from 'express';
import { asyncHandler } from '../../middlewares/errorsMiddleware';
import { authMiddleware, requireRole } from '../../middlewares/authMiddleware';
import {
  createEventController,
  getEventByIdController,
  getEventsController,
  updateOccupancyController,
} from './event.controller';

export const router = Router();

router.get('/', asyncHandler(authMiddleware), asyncHandler(getEventsController));
router.get('/:id', asyncHandler(authMiddleware), asyncHandler(getEventByIdController));
router.post('/', asyncHandler(authMiddleware), requireRole('admin'), asyncHandler(createEventController));
router.patch(
  '/:id/occupancy',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  asyncHandler(updateOccupancyController),
);
```

Pass controllers directly to `asyncHandler` (no `async (req, res) => controller(req, res)` wrapper). Static paths (`/stats`) are declared **before** `/:id`.

## Controller

```ts
import Boom from '@hapi/boom';
import { Request, Response } from 'express';
import { getUserFromRequest } from '../../middlewares/authMiddleware';
import { createEventService, getEventsService } from './event.service';

export const getEventsController = async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category : 'all';

  res.status(200).json(await getEventsService({ search, category }));
};

export const createEventController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);
  const { title, venueName, address, startsAt, capacity, latitude, longitude } = req.body;

  if (typeof title !== 'string' || !title.trim()) {
    throw Boom.badRequest('Title is required');
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw Boom.badRequest('Capacity must be a positive integer');
  }

  // ...validate the rest

  const event = await createEventService({
    title: title.trim(),
    venueName,
    address,
    startsAt,
    capacity,
    latitude,
    longitude,
    createdBy: user.id,
  });

  res.status(201).json(event);
};
```

## Conventions

- Validate type **and** shape: strings trimmed and non-empty, numbers with ranges, enums against an allow-list (`['live', 'open', 'almost-full', 'closed']`), ISO dates parse, lat/lng in range.
- Pass the service a clean DTO, never `req.body` itself.
- Status codes: `201` create, `200` read/update, `204` delete (no body).
- Authenticated handlers: `const user = getUserFromRequest(req);` and pass `user.id` to the service.
- Repeated validation goes in `<entity>.validation.ts` as small functions that throw `Boom.badRequest`.
- `String(req.params.id)` when reading params.
