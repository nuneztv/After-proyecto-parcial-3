import { Request, Response } from 'express';
import { getBearerToken, getUserFromRequest } from '../../middlewares/authMiddleware';
import {
  getMeService,
  loginService,
  logoutService,
  refreshService,
  registerService,
} from './auth.service';
import { parseLoginBody, parseRefreshBody, parseRegisterBody } from './auth.validation';

export const registerController = async (req: Request, res: Response) => {
  res.status(201).json(await registerService(parseRegisterBody(req.body), 'client'));
};

export const registerAdminController = async (req: Request, res: Response) => {
  res.status(201).json(await registerService(parseRegisterBody(req.body), 'admin'));
};

export const loginController = async (req: Request, res: Response) => {
  res.status(200).json(await loginService(parseLoginBody(req.body)));
};

export const loginAdminController = async (req: Request, res: Response) => {
  res.status(200).json(await loginService(parseLoginBody(req.body), 'admin'));
};

export const refreshController = async (req: Request, res: Response) => {
  res.status(200).json(await refreshService(parseRefreshBody(req.body)));
};

export const getMeController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);

  res.status(200).json(await getMeService(user.id));
};

// authMiddleware already validated the token; the raw value identifies the session to revoke
export const logoutController = async (req: Request, res: Response) => {
  await logoutService(getBearerToken(req));

  res.status(204).end();
};
