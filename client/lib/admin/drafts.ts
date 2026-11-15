import type { DraftKey } from './types';

export const NEW_DRAFT_KEY: DraftKey = 'new';

const EDIT_PREFIX = 'edit:';
// Same shape the API accepts for an event id (server/src/features/events/event.validation.ts)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EVENTS_PATH = '/admin/events';
export const NEW_EVENT_PATH = '/admin/events/new';
const MAP_PATH = '/admin/map';

export const isEventId = (value: string): boolean => UUID_PATTERN.test(value);

export const toEditDraftKey = (eventId: string): DraftKey => `${EDIT_PREFIX}${eventId}`;

// Reads the ?draft= value of the map page; anything unknown falls back to the create draft
export const parseDraftKey = (value: string | null): DraftKey => {
  const eventId = value?.startsWith(EDIT_PREFIX) ? value.slice(EDIT_PREFIX.length) : null;
  return eventId && isEventId(eventId) ? toEditDraftKey(eventId) : NEW_DRAFT_KEY;
};

export const getEditEventPath = (eventId: string): string => `${EVENTS_PATH}/${eventId}/edit`;

// Form that owns the draft: where the map page goes back to
export const getDraftFormPath = (key: DraftKey): string =>
  key === NEW_DRAFT_KEY ? NEW_EVENT_PATH : getEditEventPath(key.slice(EDIT_PREFIX.length));

export const getDraftMapPath = (key: DraftKey): string =>
  `${MAP_PATH}?draft=${encodeURIComponent(key)}`;
