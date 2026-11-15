import { Request, Response } from 'express';
import { getUserFromRequest } from '../../middlewares/authMiddleware';
import { parseUuid } from '../../shared/validation';
import { getPaymentByIdService, getPaymentsService } from './payment.service';

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
