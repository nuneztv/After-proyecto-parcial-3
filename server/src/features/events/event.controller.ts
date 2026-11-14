import { Request, Response } from 'express';
import {
  getEventActivityService,
  getEventByIdService,
  getEventsService,
  getEventStatsService,
  getRecentActivityService,
} from './event.service';
import { parseActivityLimit, parseEventFilters, parseEventId } from './event.validation';

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
