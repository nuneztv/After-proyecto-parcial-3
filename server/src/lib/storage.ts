import { IMAGES_BUCKET, isSupabaseConfigured, MAX_IMAGE_BYTES, SUPABASE_URL } from '../config';
import { getSupabase } from './supabase';

// Allow-list shared by multer's fileFilter, the bucket settings and the stored file name
export const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const IMAGE_MIME_TYPES = Object.keys(IMAGE_EXTENSIONS);

// Only names this server generates (<uuid>.<ext>) are accepted back from the client
const STORED_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

const getPublicFolderUrl = (userId: string): string =>
  `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${IMAGES_BUCKET}/${userId}/`;

// Built from config instead of the Supabase client so it is a pure check (no network, no client)
export const isUserImageUrl = (url: string, userId: string): boolean => {
  if (!SUPABASE_URL || !userId) {
    return false;
  }

  const folderUrl = getPublicFolderUrl(userId);

  return url.startsWith(folderUrl) && STORED_FILE_PATTERN.test(url.slice(folderUrl.length));
};

// Idempotent and never throws: a missing bucket only breaks uploads, not the rest of the API
export const ensureImagesBucket = async (): Promise<void> => {
  if (!isSupabaseConfigured()) {
    console.warn('SUPABASE_* variables are not set: image uploads are disabled');
    return;
  }

  try {
    const storage = getSupabase().storage;
    const existing = await storage.getBucket(IMAGES_BUCKET);

    if (existing.data) {
      if (!existing.data.public) {
        console.warn(`Storage bucket "${IMAGES_BUCKET}" is private: uploaded image URLs will not load`);
      }

      return;
    }

    const created = await storage.createBucket(IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
      allowedMimeTypes: IMAGE_MIME_TYPES,
    });

    // Another instance may have created it between getBucket and createBucket
    if (created.error && !/already exists/i.test(created.error.message)) {
      console.error(`Could not create storage bucket "${IMAGES_BUCKET}"`, created.error);
      return;
    }

    console.info(`Storage bucket "${IMAGES_BUCKET}" is ready`);
  } catch (error) {
    console.error(`Could not check storage bucket "${IMAGES_BUCKET}"`, error);
  }
};
