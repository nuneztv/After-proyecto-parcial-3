import { Request, Response } from 'express';
import { getBearerToken, getUserFromRequest } from '../../middlewares/authMiddleware';
import {
  createOAuthSessionService,
  getMeService,
  getOAuthUrlService,
  loginService,
  logoutService,
  refreshService,
  registerService,
  requestPasswordResetService,
  resetPasswordService,
} from './auth.service';
import {
  parseForgotPasswordBody,
  parseLoginBody,
  parseOAuthProvider,
  parseOAuthSessionBody,
  parseRefreshBody,
  parseRegisterBody,
  parseResetPasswordBody,
} from './auth.validation';

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

// 204 whether or not the email has an account (see requestPasswordResetService)
export const forgotPasswordController = async (req: Request, res: Response) => {
  await requestPasswordResetService(parseForgotPasswordBody(req.body));

  res.status(204).end();
};

// Authorized with the recovery session from the reset email (authMiddleware validated it)
export const resetPasswordController = async (req: Request, res: Response) => {
  const user = getUserFromRequest(req);

  await resetPasswordService(user.id, getBearerToken(req), parseResetPasswordBody(req.body));
  res.status(204).end();
};

export const getOAuthUrlController = async (req: Request, res: Response) => {
  res.status(200).json({ url: await getOAuthUrlService(parseOAuthProvider(req.params.provider)) });
};

export const createOAuthSessionController = async (req: Request, res: Response) => {
  res.status(200).json(await createOAuthSessionService(parseOAuthSessionBody(req.body)));
};
