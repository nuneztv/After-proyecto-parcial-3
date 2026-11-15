'use client';

import { useId } from 'react';
import type { ChangeEvent } from 'react';
import Image from 'next/image';
import { IMAGE_ACCEPT, isRemoteImage } from '@/lib/admin/images';
import { Icon } from '../Icon/Icon';

interface ImageUploadProps {
  // Public URL of the uploaded image, or null when there is none yet
  value: string | null;
  uploading: boolean;
  // Validation or upload message, shown under the picker
  error?: string | null;
  // Blocks every control, e.g. while the form is submitting
  disabled?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}

export const ImageUpload = ({
  value,
  uploading,
  error,
  disabled = false,
  onSelect,
  onClear,
}: ImageUploadProps) => {
  const errorId = useId();
  const busy = uploading || disabled;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires onChange
    e.target.value = '';
    if (file) onSelect(file);
  };

  let label = 'Choose an image';
  if (uploading) label = 'Uploading...';
  else if (value) label = 'Replace image';

  return (
    <div className="upload-field">
      {value && (
        <div className="upload-preview">
          <Image
            src={value}
            alt="Event image preview"
            width={600}
            height={300}
            className="upload-preview__image"
            unoptimized={isRemoteImage(value)}
          />
          <button
            type="button"
            className="upload-preview__remove"
            onClick={onClear}
            disabled={busy}
          >
            Remove image
          </button>
        </div>
      )}

      <label className={busy ? 'upload upload--disabled' : 'upload'}>
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          // Visually hidden but still focusable: `hidden` would drop it from the tab order
          className="visually-hidden"
          onChange={handleChange}
          disabled={busy}
          aria-label="Upload event image"
          aria-describedby={error ? errorId : undefined}
        />
        <span className="upload__text">{label}</span>
        <Icon name="refresh" size={18} />
      </label>

      {error && (
        <span id={errorId} className="form-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
