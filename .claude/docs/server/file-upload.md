# File uploads (multer + Supabase Storage)

Used for event images in `/admin/events/new` (`components/admin/ImageUpload`). Dependencies: `multer`, `@types/multer`.

## Service (`features/uploads/upload.service.ts`)

```ts
import Boom from '@hapi/boom';
import { randomUUID } from 'node:crypto';
import { IMAGES_BUCKET } from '../../config';
import { supabase } from '../../lib/supabase';

export const IMAGE_MAX_SIZE_MB = 5;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const IMAGE_MIME_TYPES = Object.keys(EXTENSIONS);

// Called at startup from index.ts; idempotent
export const initStorage = async (): Promise<void> => {
  const { error } = await supabase.storage.createBucket(IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: `${IMAGE_MAX_SIZE_MB}MB`,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });

  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
};

const getUserFolderUrl = (userId: string): string =>
  supabase.storage.from(IMAGES_BUCKET).getPublicUrl(`${userId}/`).data.publicUrl;

// Use before storing an image URL sent by the client (e.g. createEvent's imageUrl)
export const isUserImageUrl = (url: string, userId: string): boolean =>
  url.startsWith(getUserFolderUrl(userId));

export const uploadImageService = async (userId: string, file: Express.Multer.File): Promise<string> => {
  const path = `${userId}/${randomUUID()}.${EXTENSIONS[file.mimetype]}`;

  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype });

  if (error) {
    throw Boom.badGateway('The image could not be stored');
  }

  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
};
```

## Router

```ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(Boom.unsupportedMediaType('Only png, jpeg and webp images are supported'));
  },
});

export const router = Router();

// Authenticate first so anonymous requests never get their body parsed
router.post(
  '/images',
  asyncHandler(authMiddleware),
  requireRole('admin'),
  upload.single('file'),
  asyncHandler(uploadImageController),
);
```

Mount at `/api/uploads`. Controller: `if (!req.file) throw Boom.badRequest('An image is required in the "file" field')`, then `res.status(201).json({ url })`.

## Notes

- multer's `LIMIT_FILE_SIZE` error is not Boom: map it in `errorsMiddleware` to `413` for a clean message.
- `fileFilter` trusts the client's MIME type; the bucket's `allowedMimeTypes` is the second line of defense.
- Add `IMAGES_BUCKET` to `config.ts` and `.env.example`.
