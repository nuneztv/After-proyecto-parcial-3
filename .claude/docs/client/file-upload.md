# File upload hook (event images)

Server contract: `.claude/docs/server/file-upload.md` → `POST /api/uploads/images`, field `file`, admin only, returns `{ url }`. Optional dependency: `browser-image-compression`.

```ts
'use client';

import { useEffect, useState } from 'react';
import { useAxios } from '@/contexts/AxiosProvider';
import { getErrorMessage } from '@/lib/errors';

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const IMAGE_ACCEPT = ALLOWED_TYPES.join(',');

export const useImageUpload = () => {
  const api = useAxios();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Release the object URL when it is replaced or the component unmounts
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const clear = () => {
    setImageUrl(null);
    setPreviewUrl(null);
    setError(null);
  };

  const selectFile = async (file: File) => {
    clear();

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only png, jpeg and webp images are supported');
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`The image must be smaller than ${MAX_SIZE_MB} MB`);
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      // No Content-Type header: axios sets the multipart boundary itself
      const { data } = await api.post<{ url: string }>('/api/uploads/images', formData);
      setPreviewUrl(URL.createObjectURL(file));
      setImageUrl(data.url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return { imageUrl, previewUrl, uploading, error, selectFile, clear };
};
```

## Using it in `components/admin/ImageUpload`

`ImageUpload` becomes presentational: props `{ previewUrl, uploading, error, onSelect: (file: File) => void }`. The new-event form owns the hook, sends `imageUrl` (not the file) in `createEvent`, and disables "Create Event" while `uploading`. Reset `event.target.value = ''` after reading the file so the same file can be chosen again.
