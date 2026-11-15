import Boom from '@hapi/boom';
import { isUserImageUrl } from '../../lib/storage';
import {
  CreateEventDTO,
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  EventCategory,
  EventFilters,
  EventStatus,
  UpdateEventDTO,
} from './event.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEARCH_MAX_LENGTH = 100;
const ACTIVITY_LIMIT_MIN = 1;
const ACTIVITY_LIMIT_MAX = 100;
const TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 500;
const VENUE_MAX_LENGTH = 80;
const ADDRESS_MAX_LENGTH = 160;
const CAPACITY_MIN = 1;
const CAPACITY_MAX = 100000;
const DELTA_MAX = 50;
const IMAGE_URL_MAX_LENGTH = 500;
// An explicit offset is required so the stored instant never depends on the server time zone
// Hours 00-23 and minutes/seconds 00-59: V8 would otherwise accept "T24:00"
const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

const isCategory = (value: string): value is EventCategory =>
  (EVENT_CATEGORIES as readonly string[]).includes(value);

const isStatus = (value: string): value is EventStatus =>
  (EVENT_STATUSES as readonly string[]).includes(value);

// Express parses ?a=1&a=2 as an array: anything that is not a single string is rejected
const optionalString = (value: unknown, message: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw Boom.badRequest(message);
  }

  return value;
};

export const parseEventId = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw Boom.badRequest('Invalid event id');
  }

  return value;
};

export const parseEventFilters = (query: unknown): EventFilters => {
  const { search, category, status } = (query ?? {}) as Record<string, unknown>;

  const searchText = (
    optionalString(search, 'Invalid search') ?? ''
  ).trim();

  if (searchText.length > SEARCH_MAX_LENGTH) {
    throw Boom.badRequest(`Search must be at most ${SEARCH_MAX_LENGTH} characters`);
  }

  const categoryValue = optionalString(category, 'Invalid category') ?? 'all';

  if (categoryValue !== 'all' && !isCategory(categoryValue)) {
    throw Boom.badRequest('Invalid category');
  }

  const statusValue = optionalString(status, 'Invalid status') ?? 'all';

  if (statusValue !== 'all' && !isStatus(statusValue)) {
    throw Boom.badRequest('Invalid status');
  }

  return { search: searchText, category: categoryValue, status: statusValue };
};

export const parseActivityLimit = (value: unknown, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const limit = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;

  if (!Number.isInteger(limit) || limit < ACTIVITY_LIMIT_MIN || limit > ACTIVITY_LIMIT_MAX) {
    throw Boom.badRequest(
      `Limit must be an integer between ${ACTIVITY_LIMIT_MIN} and ${ACTIVITY_LIMIT_MAX}`,
    );
  }

  return limit;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredText = (
  value: unknown,
  maxLength: number,
  requiredMessage: string,
  tooLongMessage: string,
): string => {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    throw Boom.badRequest(requiredMessage);
  }

  if (text.length > maxLength) {
    throw Boom.badRequest(tooLongMessage);
  }

  return text;
};

const optionalText = (
  value: unknown,
  maxLength: number,
  invalidMessage: string,
  tooLongMessage: string,
): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw Boom.badRequest(invalidMessage);
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw Boom.badRequest(tooLongMessage);
  }

  return text;
};

// Date.parse rolls impossible days over (2026-02-30 -> March 2), so the calendar day is checked
// explicitly; otherwise Postgres rejects the value and the client gets a 500 instead of a 400
const isRealCalendarDay = (value: string): boolean => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const parseIsoDate = (value: unknown, message: string): string => {
  if (
    typeof value !== 'string' ||
    !ISO_DATE_PATTERN.test(value) ||
    !isRealCalendarDay(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw Boom.badRequest(message);
  }

  return value;
};

const parseCoordinate = (value: unknown, limit: number, message: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -limit || value > limit) {
    throw Boom.badRequest(message);
  }

  return value;
};

const parseCategories = (value: unknown): EventCategory[] => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw Boom.badRequest('Invalid category');
  }

  const categories: EventCategory[] = [];

  for (const item of value) {
    if (typeof item !== 'string' || !isCategory(item)) {
      throw Boom.badRequest('Invalid category');
    }

    if (!categories.includes(item)) {
      categories.push(item);
    }
  }

  return categories;
};

// Shape only: whether the URL belongs to the caller is checked by ensureOwnImageUrl
const parseImageUrl = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.length > IMAGE_URL_MAX_LENGTH) {
    throw Boom.badRequest('Invalid image URL');
  }

  return value.trim() || null;
};

// Only images uploaded by this admin (their Storage folder) may be attached to an event,
// so a client cannot point events at arbitrary or other users' URLs
export const ensureOwnImageUrl = (imageUrl: string | null, userId: string): void => {
  if (imageUrl !== null && !isUserImageUrl(imageUrl, userId)) {
    throw Boom.badRequest('Invalid image URL');
  }
};

// Field parsers shared by create and update, so both endpoints report the same messages
const parseTitle = (value: unknown): string =>
  requiredText(
    value,
    TITLE_MAX_LENGTH,
    'Title is required',
    `Title must be at most ${TITLE_MAX_LENGTH} characters`,
  );

const parseDescription = (value: unknown): string =>
  optionalText(
    value,
    DESCRIPTION_MAX_LENGTH,
    'Description is invalid',
    `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
  );

const parseVenueName = (value: unknown): string =>
  requiredText(
    value,
    VENUE_MAX_LENGTH,
    'Venue is required',
    `Venue must be at most ${VENUE_MAX_LENGTH} characters`,
  );

const parseAddress = (value: unknown): string =>
  optionalText(
    value,
    ADDRESS_MAX_LENGTH,
    'Address is invalid',
    `Address must be at most ${ADDRESS_MAX_LENGTH} characters`,
  );

const parseStartsAt = (value: unknown): string => parseIsoDate(value, 'Start date is invalid');

const parseEndsAt = (value: unknown): string | null =>
  value === undefined || value === null ? null : parseIsoDate(value, 'End date is invalid');

const ensureEndAfterStart = (startsAt: string, endsAt: string | null): void => {
  if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw Boom.badRequest('End must be after start');
  }
};

const parseLatitude = (value: unknown): number => parseCoordinate(value, 90, 'Latitude is invalid');

const parseLongitude = (value: unknown): number =>
  parseCoordinate(value, 180, 'Longitude is invalid');

const parseCapacity = (value: unknown): number => {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < CAPACITY_MIN ||
    value > CAPACITY_MAX
  ) {
    throw Boom.badRequest(`Capacity must be an integer between ${CAPACITY_MIN} and ${CAPACITY_MAX}`);
  }

  return value;
};

export const parseCreateEventBody = (body: unknown): CreateEventDTO => {
  if (!isRecord(body)) {
    throw Boom.badRequest('Invalid body');
  }

  const title = parseTitle(body.title);
  const description = parseDescription(body.description);
  const venueName = parseVenueName(body.venueName);
  const address = parseAddress(body.address);

  const startsAt = parseStartsAt(body.startsAt);
  const endsAt = parseEndsAt(body.endsAt);

  ensureEndAfterStart(startsAt, endsAt);

  const latitude = parseLatitude(body.latitude);
  const longitude = parseLongitude(body.longitude);
  const capacity = parseCapacity(body.capacity);

  return {
    title,
    description,
    venueName,
    // The table requires an address: the venue name is the best fallback the admin gave us
    address: address || venueName,
    startsAt,
    endsAt,
    latitude,
    longitude,
    capacity,
    categories: parseCategories(body.categories),
    imageUrl: parseImageUrl(body.imageUrl),
  };
};

// Editable through PATCH /api/events/:id; anything else (status, occupied, categories, id...)
// is rejected by name so the client learns which field it cannot send
const UPDATABLE_EVENT_FIELDS = [
  'title',
  'description',
  'venueName',
  'address',
  'startsAt',
  'endsAt',
  'latitude',
  'longitude',
  'capacity',
  'imageUrl',
] as const;

type UpdatableEventField = (typeof UPDATABLE_EVENT_FIELDS)[number];

const isUpdatableEventField = (key: string): key is UpdatableEventField =>
  (UPDATABLE_EVENT_FIELDS as readonly string[]).includes(key);

// Partial update: only the keys present are parsed, with the same rules as create. null is only
// meaningful for endsAt (no end) and imageUrl (remove image); the text parsers would turn it
// into '' silently, so it is rejected for the other fields
export const parseUpdateEventBody = (body: unknown): UpdateEventDTO => {
  if (!isRecord(body)) {
    throw Boom.badRequest('Invalid body');
  }

  for (const key of Object.keys(body)) {
    if (!isUpdatableEventField(key)) {
      throw Boom.badRequest(`Field "${key}" cannot be updated`);
    }
  }

  const has = (key: UpdatableEventField): boolean => body[key] !== undefined;

  if (!UPDATABLE_EVENT_FIELDS.some(has)) {
    throw Boom.badRequest('Nothing to update');
  }

  const dto: UpdateEventDTO = {};

  if (has('title')) {
    dto.title = parseTitle(body.title);
  }

  if (has('description')) {
    if (body.description === null) {
      throw Boom.badRequest('Description is invalid');
    }

    dto.description = parseDescription(body.description);
  }

  if (has('venueName')) {
    dto.venueName = parseVenueName(body.venueName);
  }

  if (has('address')) {
    if (body.address === null) {
      throw Boom.badRequest('Address is invalid');
    }

    const address = parseAddress(body.address);

    // Same fallback as create (the table requires an address): a blank address resets it to
    // the venue name. With a venue in the same request that is the new one; otherwise null
    // tells the repository to copy the stored venue_name inside the UPDATE (no extra read)
    dto.address = address || dto.venueName || null;
  }

  if (has('startsAt')) {
    dto.startsAt = parseStartsAt(body.startsAt);
  }

  if (has('endsAt')) {
    dto.endsAt = parseEndsAt(body.endsAt);
  }

  // Only when both are sent; against the stored values it is checked inside the transaction
  if (dto.startsAt !== undefined && dto.endsAt !== undefined) {
    ensureEndAfterStart(dto.startsAt, dto.endsAt);
  }

  if (has('latitude')) {
    dto.latitude = parseLatitude(body.latitude);
  }

  if (has('longitude')) {
    dto.longitude = parseLongitude(body.longitude);
  }

  if (has('capacity')) {
    dto.capacity = parseCapacity(body.capacity);
  }

  if (has('imageUrl')) {
    dto.imageUrl = parseImageUrl(body.imageUrl);
  }

  return dto;
};

export const parseOccupancyDelta = (body: unknown): number => {
  const delta = isRecord(body) ? body.delta : undefined;

  if (
    typeof delta !== 'number' ||
    !Number.isInteger(delta) ||
    delta === 0 ||
    delta < -DELTA_MAX ||
    delta > DELTA_MAX
  ) {
    throw Boom.badRequest(`Delta must be a non-zero integer between -${DELTA_MAX} and ${DELTA_MAX}`);
  }

  return delta;
};
