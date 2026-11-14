import Boom from '@hapi/boom';
import { NextFunction, Request, Response } from 'express';
import { getProfileRoleService } from '../features/profiles/profile.service';
import { getSupabase } from '../lib/supabase';
import { AuthUser, Role } from '../shared/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Async: wrap it with asyncHandler in routers (Express 4 does not forward rejected promises)
export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw Boom.unauthorized('Missing or malformed Authorization header');
  }

  const { data, error } = await getSupabase().auth.getUser(token);

  if (error || !data.user) {
    // The client's axios interceptor reacts to this 401 by calling /api/auth/refresh
    throw Boom.unauthorized('Invalid or expired token');
  }

  req.user = {
    id: data.user.id,
    email: data.user.email ?? '',
    role: await getProfileRoleService(data.user.id),
  };

  next();
};

export const requireRole = (role: Role) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    next(Boom.unauthorized('User not authenticated'));
    return;
  }

  if (req.user.role !== role) {
    next(Boom.forbidden('Administrators only'));
    return;
  }

  next();
};

export const getUserFromRequest = (req: Request): AuthUser => {
  if (!req.user) {
    throw Boom.unauthorized('User not authenticated');
  }

  return req.user;
};
