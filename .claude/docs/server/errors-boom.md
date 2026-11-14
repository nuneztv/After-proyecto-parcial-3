# Errors with Boom

## Which status

| Situation | Call | Status |
|-----------|------|--------|
| Missing/invalid body, bad params | `Boom.badRequest('Title is required')` | 400 |
| No/invalid/expired token | `Boom.unauthorized('Invalid or expired token')` | 401 |
| Authenticated but wrong role | `Boom.forbidden('Administrators only')` | 403 |
| Not found or not owned by caller | `Boom.notFound('Event not found')` | 404 |
| Duplicate / state conflict (email taken, over capacity) | `Boom.conflict('...')` | 409 |
| Wrong file type | `Boom.unsupportedMediaType('Only png, jpeg and webp images are supported')` | 415 |
| Supabase Auth/Storage failed | `Boom.badGateway('The storage service failed to respond')` | 502 |

Messages are short, in English, and never include SQL, stack traces or secrets. The client shows `message` in a toast.

## Error middleware

`src/middlewares/errorsMiddleware.ts` (already exists), registered after every router in `app.ts`. Keep `asyncHandler` in the same file: Express 4 needs it to forward rejected promises.

```ts
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
    // Log the real cause; the client only gets the generic message
    console.error(error);
  }

  return res.status(statusCode).json(payload);
};

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
```

Note: the current version overwrites `payload.message` with `boomError.message`, which leaks internal messages (e.g. a pg error) on 500s. Use `payload` as-is (Boom already keeps the message for 4xx and hides it for 5xx).

Response shape: `{ statusCode, error, message }`. The client reads `error.response.data.message` (see `client/lib/errors.ts`).

## Rethrow rule

When catching around external calls, never swallow a Boom you already created: `if (Boom.isBoom(error)) throw error;`.
