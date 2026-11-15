// Same allow-list and limit as server/src/lib/storage.ts and server/src/config.ts:
// checking them first saves a doomed upload, the server stays the authority
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_MB = 5;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

// Value for <input type="file" accept>
export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(',');

// Multipart field read by the server's multer middleware
export const IMAGE_FIELD = 'image';

// Messages match the API's 415 / 413 answers
export const validateImageFile = (file: File): string | null => {
  if (!IMAGE_MIME_TYPES.includes(file.type)) return 'Only JPEG, PNG or WebP images are allowed';
  if (file.size > MAX_IMAGE_BYTES) return `Image must be at most ${MAX_IMAGE_MB} MB`;
  return null;
};

// Supabase Storage URLs are not listed in next.config images.remotePatterns: next/image
// must render them with `unoptimized` (it skips the default loader and its host check)
export const isRemoteImage = (src: string): boolean => /^https?:\/\//i.test(src);
