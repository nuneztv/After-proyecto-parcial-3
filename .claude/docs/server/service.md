# Service

The service owns business rules: "does this exist", "is this the user's", "should we notify others".

```ts
import Boom from '@hapi/boom';
import { broadcast } from '../../lib/realtime';
import {
  createActivityRepository,
  findEventByIdRepository,
  updateOccupancyRepository,
} from './event.repository';
import { Event } from './event.types';

// Reused guard: a repository miss becomes a 404
const getExistingEvent = async (id: string): Promise<Event> => {
  const event = await findEventByIdRepository(id);

  if (!event) {
    throw Boom.notFound('Event not found');
  }

  return event;
};

export const getEventByIdService = async (id: string): Promise<Event> => getExistingEvent(id);

export const updateOccupancyService = async (id: string, occupied: number): Promise<Event> => {
  const event = await getExistingEvent(id);

  if (occupied > event.capacity) {
    throw Boom.conflict('Occupancy cannot exceed capacity');
  }

  const updated = await updateOccupancyRepository(id, occupied);
  const activity = await createActivityRepository(id, `${occupied} people at ${updated.title}`);

  // After the write succeeded; not awaited on purpose
  void broadcast('events', 'event-updated', updated);
  void broadcast(`event:${id}`, 'activity-created', activity);

  return updated;
};
```

## Ownership (user-scoped data)

Payments and saved events belong to a user. Query by `user_id` in the repository; a miss means "not found or not yours" → `404`:

```ts
export const getMyPaymentsService = async (userId: string) => findPaymentsByUserRepository(userId);

export const unsaveEventService = async (userId: string, eventId: string): Promise<void> => {
  const deleted = await deleteSavedEventRepository(userId, eventId);

  if (!deleted) {
    throw Boom.notFound('Saved event not found');
  }
};
```

Never return another user's rows, and never return secrets (the old `hidePassword` problem disappears once passwords live only in Supabase Auth).

## Side effects

- Realtime: emit **after** the repository succeeded, fire-and-forget (see `realtime-supabase.md`).
- Supabase Auth / Storage errors: wrap as `Boom.badGateway('...')` or `Boom.unauthorized(...)`, and rethrow Boom errors untouched:

```ts
} catch (error) {
  if (Boom.isBoom(error)) throw error;
  throw Boom.badGateway('The storage service failed to respond');
}
```

- Multi-step writes that must succeed together (payment + occupancy) use a transaction (`withTransaction` in `repository.md`).
- A service may call another feature's **service**, never its repository.
