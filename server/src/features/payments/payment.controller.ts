import { Request, Response } from 'express';
import { getUserFromRequest } from '../../middlewares/authMiddleware';
import { parseUuid } from '../../shared/validation';
import { getPaymentByIdService, getPaymentsService, reserveTicketService } from './payment.service';

// The user always comes from the token, never from the request
export const getPaymentsController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);

  res.status(200).json(await getPaymentsService(user.id));
};

export const getPaymentByIdController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);

  res
    .status(200)
    .json(await getPaymentByIdService(parseUuid(req.params.id, 'Invalid payment id'), user.id));
};

// 201 for a new reservation, 200 when the user already had one for this ticket
export const reserveTicketController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);
  const { productId } = (req.body ?? {}) as { productId?: unknown };

  const result = await reserveTicketService(user.id, parseUuid(productId, 'Invalid product id'));
  res.status(result.created ? 201 : 200).json(result);
};
