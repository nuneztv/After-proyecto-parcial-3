import { Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';

export const errorsMiddleware = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const boomError = Boom.isBoom(error) ? error : Boom.boomify(error);
  const { statusCode, payload } = boomError.output;

  if (statusCode >= 500) {
    // The real cause stays in the server log; the client only gets Boom's generic message
    console.error(error);
  }

  // Boom keeps the message for 4xx and replaces it with a generic one for 5xx
  return res.status(statusCode).json(payload);
};

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
