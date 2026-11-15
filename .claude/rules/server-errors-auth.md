---
paths:
  - "server/src/middlewares/**/*.ts"
  - "server/src/**/*.controller.ts"
  - "server/src/**/*.service.ts"
  - "server/src/**/*.router.ts"
---

# Server errors, auth and uploads

- Errors are `@hapi/boom` objects: `badRequest` (400), `unauthorized` (401), `forbidden` (403), `notFound` (404), `conflict` (409), `unsupportedMediaType` (415), `badGateway` (502, Supabase Auth/Storage failed).
- `src/middlewares/errorsMiddleware.ts` is the only place that turns errors into JSON (`{ statusCode, error, message }`). It is registered **after** all routers. Non-Boom errors become `500` without leaking internal messages.
- Express 4: async handlers and async middlewares are wrapped with `asyncHandler`; do not add try/catch just to call `next(err)`.
- Validate at the edge (controller). Services trust their typed inputs but still enforce ownership and existence.
- Authenticated routes use `authMiddleware` per route (Supabase `auth.getUser(token)`); admin routes add `requireRole('admin')`. Handlers read the user with `getUserFromRequest(req)`, never `req.user!`.
- Auth endpoints: `POST /api/auth/register`, `/login`, `/refresh`, `GET /api/auth/me`. Login returns `accessToken`, `refreshToken`, `expiresAt`. Passwords never touch our tables.
- Ownership: every query for user data filters by `user_id`. A row that exists but belongs to someone else returns `404`, not `403`.
- Uploads: multer `memoryStorage`, `limits.fileSize`, `fileFilter` allow-list; auth (+ `requireRole('admin')`) **before** multer; files stored under `<userId>/<uuid>.<ext>`. Client-sent image URLs are validated with `isUserImageUrl` before being stored.
- Realtime broadcasts are fire-and-forget: a failure is logged, never thrown into the request.

Templates: `.claude/docs/server/errors-boom.md`, `auth-middleware.md`, `file-upload.md`, `realtime-supabase.md`.
