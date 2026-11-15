import { Request, Response } from 'express';
import { parseUuid } from '../../shared/validation';
import { getProductByIdService, getProductsService } from './product.service';

// ?eventId=<uuid> narrows the list to the tickets of one event
export const getProductsController = async (req: Request, res: Response) => {
  const { eventId } = req.query;
  const filters = { eventId: eventId === undefined ? null : parseUuid(eventId, 'Invalid event id') };

  res.status(200).json(await getProductsService(filters));
};

export const getProductByIdController = async (req: Request, res: Response) => {
  res.status(200).json(await getProductByIdService(parseUuid(req.params.id, 'Invalid product id')));
};
