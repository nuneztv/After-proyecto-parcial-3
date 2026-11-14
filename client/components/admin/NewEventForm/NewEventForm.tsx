'use client';

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEventDraft } from '@/contexts/admin/EventDraftProvider';
import { useEvents } from '@/contexts/admin/EventsProvider';
import { useImageUpload } from '@/hooks/admin/useImageUpload';
import { formatLocation } from '@/lib/admin/map';
import { toCreateEventInput } from '@/lib/admin/mappers';
import type { EventDraftErrors, EventDraftField } from '@/lib/admin/types';
import {
  EVENT_CAPACITY_MAX,
  EVENT_CAPACITY_MIN,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_VENUE_MAX_LENGTH,
  validateEventDraft,
} from '@/lib/admin/validation';
import { FormField } from '../FormField/FormField';
import { Icon } from '../Icon/Icon';
import { ImageUpload } from '../ImageUpload/ImageUpload';

const EVENTS_PATH = '/admin/events';

export const NewEventForm = () => {
  const router = useRouter();
  const { draft, setField, setImageUrl, resetDraft } = useEventDraft();
  const { createEvent, creating } = useEvents();
  const { uploading, error: imageError, upload, reset: resetUpload } = useImageUpload();
  const [errors, setErrors] = useState<EventDraftErrors>({});
  const locationErrorId = useId();

  const handleImageSelect = async (file: File) => {
    // A failed upload keeps the previous image; the hook reports why it failed
    const url = await upload(file);
    if (url) setImageUrl(url);
  };

  const handleImageClear = () => {
    resetUpload();
    setImageUrl(null);
  };

  const handleChange = (name: EventDraftField, value: string) => {
    setField(name, value);
    // The message no longer describes what is in the field
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Submitting mid-upload would create the event without the image being chosen
    if (creating || uploading) return;

    const fieldErrors = validateEventDraft(draft);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    // The provider toasts both outcomes; the draft is kept when the request fails
    const created = await createEvent(toCreateEventInput(draft));
    if (!created) return;

    resetDraft();
    router.push(EVENTS_PATH);
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <FormField label="Event Name" error={errors.title}>
        <input
          className="form-input"
          type="text"
          placeholder="Event name"
          maxLength={EVENT_TITLE_MAX_LENGTH}
          value={draft.title}
          onChange={(e) => handleChange('title', e.target.value)}
          disabled={creating}
        />
      </FormField>

      <FormField label="Description" error={errors.description}>
        <textarea
          className="form-input"
          placeholder="Tell people what to expect"
          maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
          value={draft.description}
          onChange={(e) => handleChange('description', e.target.value)}
          disabled={creating}
        />
      </FormField>

      <div className="form-row">
        <FormField label="Date" error={errors.date}>
          <input
            className="form-input"
            type="date"
            value={draft.date}
            onChange={(e) => handleChange('date', e.target.value)}
            disabled={creating}
          />
        </FormField>
        <FormField label="Time" error={errors.time}>
          <input
            className="form-input"
            type="time"
            value={draft.time}
            onChange={(e) => handleChange('time', e.target.value)}
            disabled={creating}
          />
        </FormField>
      </div>

      <FormField label="End Time (optional)" error={errors.endTime}>
        <input
          className="form-input"
          type="time"
          value={draft.endTime}
          onChange={(e) => handleChange('endTime', e.target.value)}
          disabled={creating}
        />
      </FormField>

      <div className="form-row">
        <FormField label="Location" error={errors.venueName}>
          <input
            className="form-input"
            type="text"
            placeholder="Venue"
            maxLength={EVENT_VENUE_MAX_LENGTH}
            value={draft.venueName}
            onChange={(e) => handleChange('venueName', e.target.value)}
            disabled={creating}
          />
        </FormField>
        <Link
          href="/admin/map"
          className="map-button"
          aria-describedby={errors.location ? locationErrorId : undefined}
        >
          <Icon name="pin" size={16} />
          Select on map
        </Link>
      </div>

      <div className="form-location">
        <Icon name="pin" size={16} />
        <span>{draft.location ? formatLocation(draft.location) : 'No location selected'}</span>
      </div>
      {errors.location && (
        <span id={locationErrorId} className="form-field__error" role="alert">
          {errors.location}
        </span>
      )}

      <FormField label="Max Capacity" error={errors.capacity}>
        <input
          className="form-input"
          type="number"
          inputMode="numeric"
          min={EVENT_CAPACITY_MIN}
          max={EVENT_CAPACITY_MAX}
          step={1}
          placeholder="150"
          value={draft.capacity}
          onChange={(e) => handleChange('capacity', e.target.value)}
          disabled={creating}
        />
      </FormField>

      {/* Not a FormField: that is a <label>, and ImageUpload holds its own label and button */}
      <div className="form-field">
        <span className="form-field__label">Upload Image (optional)</span>
        <ImageUpload
          value={draft.imageUrl}
          uploading={uploading}
          error={imageError}
          disabled={creating}
          onSelect={handleImageSelect}
          onClear={handleImageClear}
        />
      </div>

      <button type="submit" className="btn" disabled={creating || uploading}>
        {creating ? 'Creating...' : uploading ? 'Uploading image...' : 'Create Event'}
      </button>
      <Link href={EVENTS_PATH} className="cancel-link" onClick={resetDraft}>
        Cancel
      </Link>
    </form>
  );
};
