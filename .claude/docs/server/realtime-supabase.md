# Realtime on the server: Supabase Broadcast ("sockets")

The server publishes events; browsers subscribe in their Providers with the publishable key (see `.claude/docs/client/realtime-subscription.md`). The contract for After is in `.claude/docs/project/domain.md` → "Realtime contract".

## Broadcast helper: `src/lib/realtime.ts`

```ts
import { supabase } from './supabase';

// Fire-and-forget: a failed broadcast must never fail the HTTP request
export const broadcast = async (channelName: string, event: string, payload: object): Promise<void> => {
  const channel = supabase.channel(channelName);

  try {
    await channel.httpSend(event, payload);
  } catch (error) {
    console.error(`Failed to broadcast ${event} on ${channelName}`, error);
  } finally {
    await supabase.removeChannel(channel);
  }
};
```

If the installed `@supabase/supabase-js` has no `httpSend`, use `channel.send({ type: 'broadcast', event, payload })` (it falls back to HTTP when the channel is not subscribed).

## Emit from the service

```ts
export const createEventService = async (dto: CreateEventDTO): Promise<Event> => {
  const event = await createEventRepository(dto);
  void broadcast('events', 'event-created', event);   // not awaited on purpose
  return event;
};

export const deleteEventService = async (id: string): Promise<void> => {
  const deleted = await deleteEventRepository(id);

  if (!deleted) {
    throw Boom.notFound('Event not found');
  }

  void broadcast('events', 'event-deleted', { id });
};
```

## Contract conventions

- Channel per resource list (`events`) or per entity (`event:<id>` for its activity feed).
- Event names: kebab-case, past tense: `event-created`, `event-updated`, `activity-created`.
- Payload equals the REST response shape (so the client reuses `types/models.ts`), or `{ id }` for deletions.
- Emit only after the database write succeeded.
- The sender also gets the REST response; providers must dedupe by `id`.

## Privacy

Broadcast on public channels is readable by anyone with the publishable key. Events and occupancy are public info in After, so public channels are fine. Never broadcast payments, emails or anything user-scoped; for that, send only ids and let the client refetch through the authenticated API.
