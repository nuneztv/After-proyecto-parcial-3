import Boom from '@hapi/boom';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Route ids are UUIDs: anything else is a 400 before it reaches SQL (Postgres would reject the
// cast with a 500)
export const parseUuid = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw Boom.badRequest(message);
  }

  return value;
};
