---
name: add-file-upload
description: Adds file uploads end to end for After (event images): multer on the server storing in Supabase Storage, and a client hook that validates and uploads, wired into components/admin/ImageUpload. Use for images attached to events or profiles.
argument-hint: "<file kind and limits>"
disable-model-invocation: true
---

# Add file uploads

Argument: the file kind and limits (for example `event images png/jpeg/webp up to 5 MB`).

1. Read `.claude/docs/server/file-upload.md` and `.claude/docs/client/file-upload.md`.
2. Server:
   - Add `IMAGES_BUCKET` to `src/config.ts` and `server/.env.example`.
   - Create `features/uploads/` with router, controller, service, types; mount at `/api/uploads`.
   - `authMiddleware` + `requireRole('admin')` **before** multer. Allow-list MIME types and set `limits.fileSize`.
   - Store at `<userId>/<uuid>.<ext>`; create the bucket idempotently at startup (`initStorage` in `index.ts`).
   - When `createEvent` receives an `imageUrl`, validate it with `isUserImageUrl(url, userId)`.
3. Client:
   - Add `hooks/useImageUpload.ts` returning `{ imageUrl, previewUrl, uploading, error, selectFile, clear }`.
   - Make `components/admin/ImageUpload` presentational (`onSelect(file)`), owned by the new-event form.
   - If images are rendered with `next/image`, add the Supabase Storage host to `images.remotePatterns` in `next.config.js`.
4. Tests: server rejects wrong MIME type (415), missing file (400), anonymous (401) and non-admin (403); the hook rejects invalid type/size before any request.
5. Run `npm run typecheck`, `npm run lint`, `npm test` in both workspaces.
