import Boom from '@hapi/boom';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { MAX_IMAGE_BYTES } from '../config';
import { IMAGE_MIME_TYPES } from '../lib/storage';

export const IMAGE_FIELD = 'image';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(Boom.unsupportedMediaType('Only JPEG, PNG or WebP images are allowed'));
  },
}).single(IMAGE_FIELD);

// multer reports limits with its own MulterError: turn them into Boom so errorsMiddleware
// answers with a clean status and message instead of a 500
const toUploadError = (error: unknown): Error => {
  if (Boom.isBoom(error)) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return Boom.entityTooLarge(`Image must be at most ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`);
    }

    return Boom.badRequest(`Send a single image in the "${IMAGE_FIELD}" field`);
  }

  // Malformed multipart bodies come from busboy as plain errors
  return Boom.badRequest('Invalid upload');
};

// Mount after authMiddleware + requireRole so anonymous requests never get their body parsed
export const imageUploadMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  imageUpload(req, res, (error?: unknown) => {
    next(error ? toUploadError(error) : undefined);
  });
};
