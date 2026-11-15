'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEventDraft } from '@/contexts/admin/EventDraftProvider';
import { useEvents } from '@/contexts/admin/EventsProvider';
import { useImageUpload } from '@/hooks/admin/useImageUpload';
import {
  EVENTS_PATH,
  NEW_DRAFT_KEY,
  getDraftMapPath,
  isEventId,
  toEditDraftKey,
} from '@/lib/admin/drafts';
import { formatLocation } from '@/lib/admin/map';
import { toCreateEventInput, toEventDraft, toUpdateEventInput } from '@/lib/admin/mappers';
import type { EventDraftErrors, EventDraftField } from '@/lib/admin/types';
import {
  EVENT_CAPACITY_MAX,
  EVENT_CAPACITY_MIN,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_VENUE_MAX_LENGTH,
  validateEventDraft,
} from '@/lib/admin/validation';
import { EmptyState } from '../EmptyState/EmptyState';
import { FormField } from '../FormField/FormField';
import { Icon } from '../Icon/Icon';
import { ImageUpload } from '../ImageUpload/ImageUpload';

interface EventFormProps {
  mode: 'create' | 'edit';
  // Required in edit mode: the event being edited
  eventId?: string;
}

export const EventForm = ({ mode, eventId }: EventFormProps) => {
  const router = useRouter();
  const isEdit = mode === 'edit';
  // An id the API would reject with 400 is never requested
  const editId = isEdit && eventId && isEventId(eventId) ? eventId : null;
  const draftKey = editId ? toEditDraftKey(editId) : NEW_DRAFT_KEY;

  const { draft, hasDraft, setField, setImageUrl, initDraft, resetDraft } = useEventDraft(draftKey);
  const {
    createEvent,
    creating,
    updateEvent,
    saving,
    selectedEvent,
    eventLoading,
    eventError,
    loadEvent,
  } = useEvents();
  const { uploading, error: imageError, upload, reset: resetUpload } = useImageUpload();
  const [errors, setErrors] = useState<EventDraftErrors>({});
  const locationErrorId = useId();
  const endHintId = useId();
  // Id whose GET /api/events/:id finished: before that, selectedEvent may be a cached copy
  const [loadedId, setLoadedId] = useState<string | null>(null);
  // Set when the form resets its draft and navigates away: the event must not refill it
  const leaving = useRef(false);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    void loadEvent(editId).then(() => {
      if (active) setLoadedId(editId);
    });
    return () => {
      active = false;
    };
  }, [editId, loadEvent]);

  const event = editId && selectedEvent?.id === editId ? selectedEvent : null;
  const loaded = editId !== null && loadedId === editId && !eventLoading;

  // Fill the edit draft once from the fresh event; a draft that already exists (back from the
  // map) keeps the admin's changes
  useEffect(() => {
    if (event && loaded && !hasDraft && !leaving.current) initDraft(toEventDraft(event));
  }, [event, loaded, hasDraft, initDraft]);

  const busy = isEdit ? saving : creating;

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

  const leave = () => {
    leaving.current = true;
    resetDraft();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Submitting mid-upload would save the event without the image being chosen
    if (busy || uploading) return;

    // The live occupancy (kept fresh by realtime) is the lowest capacity the API accepts
    const fieldErrors = validateEventDraft(
      draft,
      isEdit && event ? { minCapacity: event.attendees } : undefined,
    );
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    // The provider toasts both outcomes; the draft is kept when the request fails
    const saved = editId
      ? await updateEvent(editId, toUpdateEventInput(draft))
      : await createEvent(toCreateEventInput(draft));
    if (!saved) return;

    leave();
    router.push(EVENTS_PATH);
  };

  if (isEdit) {
    if (!editId) return <EmptyState title="Event not found" subtitle="Invalid event id" />;
    if (!event && loadedId === editId && eventError) {
      return <EmptyState title="Something went wrong" subtitle={eventError} />;
    }
    if (!event || !hasDraft) return <EmptyState title="Loading event..." />;
  }

  let submitLabel = isEdit ? 'Save Changes' : 'Create Event';
  if (busy) submitLabel = isEdit ? 'Saving...' : 'Creating...';
  else if (uploading) submitLabel = 'Uploading image...';

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
          disabled={busy}
        />
      </FormField>

      <FormField label="Description" error={errors.description}>
        <textarea
          className="form-input"
          placeholder="Tell people what to expect"
          maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
          value={draft.description}
          onChange={(e) => handleChange('description', e.target.value)}
          disabled={busy}
        />
      </FormField>

      <div className="form-row">
        <FormField label="Date" error={errors.date}>
          <input
            className="form-input"
            type="date"
            value={draft.date}
            onChange={(e) => handleChange('date', e.target.value)}
            disabled={busy}
          />
        </FormField>
        <FormField label="Time" error={errors.time}>
          <input
            className="form-input"
            type="time"
            value={draft.time}
            onChange={(e) => handleChange('time', e.target.value)}
            disabled={busy}
          />
        </FormField>
      </div>

      <div className="form-row">
        <FormField label="End Date (optional)" error={errors.endDate}>
          <input
            className="form-input"
            type="date"
            min={draft.date || undefined}
            value={draft.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            aria-describedby={endHintId}
            disabled={busy}
          />
        </FormField>
        <FormField label="End Time (optional)" error={errors.endTime}>
          <input
            className="form-input"
            type="time"
            value={draft.endTime}
            onChange={(e) => handleChange('endTime', e.target.value)}
            aria-describedby={endHintId}
            disabled={busy}
          />
        </FormField>
      </div>
      <p id={endHintId} className="form-hint">
        No end date: same night (the next day if the end time is earlier than the start)
      </p>

      <div className="form-row">
        <FormField label="Location" error={errors.venueName}>
          <input
            className="form-input"
            type="text"
            placeholder="Venue"
            maxLength={EVENT_VENUE_MAX_LENGTH}
            value={draft.venueName}
            onChange={(e) => handleChange('venueName', e.target.value)}
            disabled={busy}
          />
        </FormField>
        <Link
          href={getDraftMapPath(draftKey)}
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
          min={event ? Math.max(EVENT_CAPACITY_MIN, event.attendees) : EVENT_CAPACITY_MIN}
          max={EVENT_CAPACITY_MAX}
          step={1}
          placeholder="150"
          value={draft.capacity}
          onChange={(e) => handleChange('capacity', e.target.value)}
          disabled={busy}
        />
      </FormField>

      {/* Not a FormField: that is a <label>, and ImageUpload holds its own label and button */}
      <div className="form-field">
        <span className="form-field__label">Upload Image (optional)</span>
        <ImageUpload
          value={draft.imageUrl}
          uploading={uploading}
          error={imageError}
          disabled={busy}
          onSelect={handleImageSelect}
          onClear={handleImageClear}
        />
      </div>

      <button type="submit" className="btn" disabled={busy || uploading}>
        {submitLabel}
      </button>
      <Link href={EVENTS_PATH} className="cancel-link" onClick={leave}>
        Cancel
      </Link>
    </form>
  );
};
