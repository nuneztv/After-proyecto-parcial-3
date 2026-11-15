import { Request, Response } from 'express';
import { getUserFromRequest } from '../../middlewares/authMiddleware';
import {
  createEventService,
  getEventActivityService,
  getEventByIdService,
  getEventsService,
  getEventStatsService,
  getRecentActivityService,
  updateEventService,
  updateOccupancyService,
} from './event.service';
import {
  ensureOwnImageUrl,
  parseActivityLimit,
  parseCreateEventBody,
  parseEventFilters,
  parseEventId,
  parseOccupancyDelta,
  parseUpdateEventBody,
} from './event.validation';

const RECENT_ACTIVITY_DEFAULT_LIMIT = 20;
const EVENT_ACTIVITY_DEFAULT_LIMIT = 50;

export const getEventsController = async (req: Request, res: Response) => {
  res.status(200).json(await getEventsService(parseEventFilters(req.query)));
};

export const getEventStatsController = async (_req: Request, res: Response) => {
  res.status(200).json(await getEventStatsService());
};

export const getRecentActivityController = async (req: Request, res: Response) => {
  const limit = parseActivityLimit(req.query.limit, RECENT_ACTIVITY_DEFAULT_LIMIT);

  res.status(200).json(await getRecentActivityService(limit));
};

export const getEventByIdController = async (req: Request, res: Response) => {
  res.status(200).json(await getEventByIdService(parseEventId(req.params.id)));
};

export const getEventActivityController = async (req: Request, res: Response) => {
  const eventId = parseEventId(req.params.id);
  const limit = parseActivityLimit(req.query.limit, EVENT_ACTIVITY_DEFAULT_LIMIT);

  res.status(200).json(await getEventActivityService(eventId, limit));
};

export const createEventController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);
  const dto = parseCreateEventBody(req.body);

  ensureOwnImageUrl(dto.imageUrl, user.id);

  res.status(201).json(await createEventService(dto, user.id));
};

export const updateEventController = async (req: Request, res: Response) => {
  const eventId = parseEventId(req.params.id);
  const dto = parseUpdateEventBody(req.body);
  const user = getUserFromRequest(req);

  res.status(200).json(await updateEventService(eventId, dto, user.id));
};

export const updateOccupancyController =async (req: Request, res: Response) => {
  const eventId = parseEventId(req.params.id);
  const delta = parseOccupancyDelta(req.body);

  res.status(200).json(await updateOccupancyService(eventId, delta));
};
