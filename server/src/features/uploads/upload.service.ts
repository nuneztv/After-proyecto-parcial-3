import Boom from '@hapi/boom';
import { randomUUID } from 'node:crypto';
import { IMAGES_BUCKET, isSupabaseConfigured } from '../../config';
import { getSupabase } from '../../lib/supabase';
import { IMAGE_EXTENSIONS } from '../../lib/storage';
import { ImageFile, UploadedImage } from './upload.types';

export const uploadImageService = async (
  userId: string,
  file: ImageFile,
): Promise<UploadedImage> => {
  const extension = IMAGE_EXTENSIONS[file.mimetype];

  // multer's fileFilter already rejected other types; this keeps the service safe on its own
  if (!extension) {
    throw Boom.unsupportedMediaType('Only JPEG, PNG or WebP images are allowed');
  }

  // Without Supabase getSupabase() throws a plain Error (a generic 500): answer a clear 502
  if (!isSupabaseConfigured()) {
    throw Boom.badGateway('Image upload failed');
  }

  // Per-user folder: isUserImageUrl later checks that a submitted imageUrl lives in it
  const path = `${userId}/${randomUUID()}.${extension}`;
  const bucket = getSupabase().storage.from(IMAGES_BUCKET);
  const { error } = await bucket.upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) {
    // The Storage error rides along as Boom data so errorsMiddleware logs the real cause
    throw Boom.badGateway('Image upload failed', error);
  }

  return { url: bucket.getPublicUrl(path).data.publicUrl };
};
