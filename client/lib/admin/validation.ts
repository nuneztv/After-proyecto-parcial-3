import type { EventDraft, EventDraftErrors, RegisterInput } from './types';

// Same limits as server/src/features/auth/auth.validation.ts: the server stays the authority
export const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateLogin = (email: string, password: string): string | null => {
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  if (!password) return 'Enter your password';
  return null;
};

export const validateRegister = (input: RegisterInput, confirmPassword: string): string | null => {
  if (!input.fullName.trim()) return 'Enter your full name';
  if (!EMAIL_PATTERN.test(input.email.trim())) return 'Enter a valid email address';
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (input.password !== confirmPassword) return 'Passwords do not match';
  return null;
};

// Same limits as server/src/features/events/event.validation.ts
export const EVENT_TITLE_MAX_LENGTH = 80;
export const EVENT_DESCRIPTION_MAX_LENGTH = 500;
export const EVENT_VENUE_MAX_LENGTH = 80;
export const EVENT_CAPACITY_MIN = 1;
export const EVENT_CAPACITY_MAX = 100000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidDate = (value: string): boolean =>
  DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export const validateEventDraft = (draft: EventDraft): EventDraftErrors => {
  const errors: EventDraftErrors = {};
  const title = draft.title.trim();
  const venueName = draft.venueName.trim();

  if (!title) errors.title = 'Enter the event name';
  else if (title.length > EVENT_TITLE_MAX_LENGTH) {
    errors.title = `Event name must be at most ${EVENT_TITLE_MAX_LENGTH} characters`;
  }

  if (draft.description.trim().length > EVENT_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be at most ${EVENT_DESCRIPTION_MAX_LENGTH} characters`;
  }

  if (!venueName) errors.venueName = 'Enter the venue';
  else if (venueName.length > EVENT_VENUE_MAX_LENGTH) {
    errors.venueName = `Venue must be at most ${EVENT_VENUE_MAX_LENGTH} characters`;
  }

  if (!isValidDate(draft.date)) errors.date = 'Select the date';
  if (!TIME_PATTERN.test(draft.time)) errors.time = 'Select the start time';

  if (draft.endTime) {
    if (!TIME_PATTERN.test(draft.endTime)) errors.endTime = 'End time is invalid';
    // An earlier end time means the event ends the next day (see toCreateEventInput)
    else if (draft.endTime === draft.time) errors.endTime = 'End time must be after the start time';
  }

  const capacity = Number(draft.capacity);
  if (
    !/^\d+$/.test(draft.capacity.trim()) ||
    capacity < EVENT_CAPACITY_MIN ||
    capacity > EVENT_CAPACITY_MAX
  ) {
    errors.capacity = `Capacity must be a whole number between ${EVENT_CAPACITY_MIN} and ${EVENT_CAPACITY_MAX}`;
  }

  if (!draft.location) errors.location = 'Select the location on the map';

  return errors;
};
