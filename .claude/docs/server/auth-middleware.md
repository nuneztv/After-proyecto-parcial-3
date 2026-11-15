# Auth (Supabase Auth + Bearer token + refresh + roles)

The server talks to Supabase Auth with the secret key. The client never calls Supabase Auth directly: it calls our `/api/auth/*` endpoints and stores the returned session.

## Types

```ts
// src/shared/types.ts
export type Role = 'client' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

// features/auth/auth.types.ts
import { Profile } from '../profiles/profile.types';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
}

export interface AuthResponse {
  user: Profile;     // id, fullName, username, email, avatarUrl, role
  session: Session | null; // null when email confirmation is enabled
}

export interface RegisterDTO { email: string; password: string; fullName: string; role: Role }
export interface LoginDTO { email: string; password: string }
```

## Service

```ts
import Boom from '@hapi/boom';
import { supabase } from '../../lib/supabase';
import { createProfileService, getProfileByIdService } from '../profiles/profile.service';

const toSession = (s: { access_token: string; refresh_token: string; expires_at?: number }) => ({
  accessToken: s.access_token,
  refreshToken: s.refresh_token,
  expiresAt: s.expires_at ?? 0,
});

export const registerService = async ({ email, password, fullName, role }: RegisterDTO): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    throw Boom.badRequest(error?.message ?? 'Could not register user');
  }

  const user = await createProfileService({ id: data.user.id, email, fullName, role });

  return { user, session: data.session ? toSession(data.session) : null };
};

export const loginService = async ({ email, password }: LoginDTO): Promise<AuthResponse> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw Boom.unauthorized('Email or password is not correct');
  }

  const user = await getProfileByIdService(data.user.id);

  return { user, session: toSession(data.session) };
};

export const refreshService = async (refreshToken: string): Promise<Session> => {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    throw Boom.unauthorized('Session expired, please log in again');
  }

  return toSession(data.session);
};
```

Routes (`features/auth/auth.router.ts`, mounted at `/api/auth`): `POST /register`, `POST /login`, `POST /refresh`, `GET /me` (protected). Controllers validate email format, password length (≥ 8), `fullName` non-empty, and only accept `role: 'admin'` from the admin register flow if the product allows it (otherwise force `'client'`).

Important: the server-side `supabase` client must be created with `auth: { persistSession: false, autoRefreshToken: false }` — it is shared by every request, so it must never keep a user session in memory.

## Middleware

```ts
// src/middlewares/authMiddleware.ts
import Boom from '@hapi/boom';
import { NextFunction, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { findProfileRoleRepository } from '../features/profiles/profile.repository';
import { AuthUser, Role } from '../shared/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw Boom.unauthorized('Missing or malformed Authorization header');
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    // The client interceptor reacts to this 401 by calling /api/auth/refresh
    throw Boom.unauthorized('Invalid or expired token');
  }

  const role = (await findProfileRoleRepository(data.user.id)) ?? 'client';
  req.user = { id: data.user.id, email: data.user.email ?? '', role };
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
```

(The middleware may read the role through a repository function because it is infrastructure, not a feature layer; keep it to that single query.)

## Using it

```ts
router.get('/', asyncHandler(authMiddleware), asyncHandler(getMyPaymentsController));
router.post('/', asyncHandler(authMiddleware), requireRole('admin'), asyncHandler(createEventController));
```

`authMiddleware` is async, so wrap it with `asyncHandler` too (Express 4). Apply it **per route**.
