'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/contexts/admin/ToastProvider';
import { adminApi } from '@/lib/admin/axios';
import { getErrorMessage } from '@/lib/admin/errors';
import { IMAGE_FIELD, validateImageFile } from '@/lib/admin/images';
import type { ApiUploadedImage } from '@/lib/admin/types';

// A 5 MB file on a slow connection needs longer than adminApi's default timeout
const UPLOAD_TIMEOUT_MS = 60000;

interface UseImageUploadResult {
  uploading: boolean;
  // Last validation or upload error, shown under the field
  error: string | null;
  // Resolves to the public URL, or null when the file was rejected or the upload failed
  upload: (file: File) => Promise<string | null>;
  // Forgets the error and ignores an upload still in flight
  reset: () => void;
}

export const useImageUpload = (): UseImageUploadResult => {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Incremented on every upload, reset and unmount: only the latest upload may resolve
  const request = useRef(0);

  useEffect(() => {
    const current = request;
    return () => {
      current.current++;
    };
  }, []);

  const reset = useCallback(() => {
    request.current++;
    setUploading(false);
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      const requestId = ++request.current;
      const invalid = validateImageFile(file);
      setError(invalid);
      if (invalid) {
        setUploading(false);
        return null;
      }

      setUploading(true);

      try {
        const body = new FormData();
        body.append(IMAGE_FIELD, file, file.name);
        // No Content-Type header: the browser adds multipart/form-data with its boundary
        const { data } = await adminApi.post<ApiUploadedImage>('/api/uploads/images', body, {
          timeout: UPLOAD_TIMEOUT_MS,
        });
        return requestId === request.current ? data.url : null;
      } catch (err) {
        if (requestId !== request.current) return null;
        const message = getErrorMessage(err);
        setError(message);
        showToast(message, 'error');
        return null;
      } finally {
        if (requestId === request.current) setUploading(false);
      }
    },
    [showToast],
  );

  return { uploading, error, upload, reset };
};
