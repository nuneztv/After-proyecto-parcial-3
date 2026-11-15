import { Request, Response } from 'express';
import { getUserFromRequest } from '../../middlewares/authMiddleware';
import { parseEventId } from '../events/event.validation';
import { getSavedEventsService, saveEventService, unsaveEventService } from './savedEvent.service';

// The user always comes from the token, never from the request: nobody can touch another
// user's favorites
export const getSavedEventsController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);

  res.status(200).json(await getSavedEventsService(user.id));
};

export const saveEventController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);

  await saveEventService(user.id, parseEventId(req.params.eventId));
  res.status(204).end();
};

export const unsaveEventController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);

  await unsaveEventService(user.id, parseEventId(req.params.eventId));
  res.status(204).end();
};
