import Boom from '@hapi/boom';
import { EVENT_CATEGORIES, EVENT_STATUSES, EventCategory, EventFilters, EventStatus } from './event.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEARCH_MAX_LENGTH = 100;
const ACTIVITY_LIMIT_MIN = 1;
const ACTIVITY_LIMIT_MAX = 100;

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
