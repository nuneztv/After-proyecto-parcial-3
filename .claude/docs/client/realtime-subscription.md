# Realtime subscriptions on the client (Supabase Broadcast)

The backend emits `(channel, event, payload)`; Providers receive them. Subscribe inside the provider's `useEffect`, always unsubscribe in the cleanup, and make state updates idempotent. Contract: `.claude/docs/project/domain.md` → "Realtime contract".

## In the provider

```tsx
import { supabase } from '@/lib/supabase';

const upsertById = (list: EventItem[], item: EventItem) =>
  list.some((e) => e.id === item.id)
    ? list.map((e) => (e.id === item.id ? item : e))
    : [...list, item];

useEffect(() => {
  const channel = supabase
    .channel('events')
    .on('broadcast', { event: 'event-created' }, ({ payload }) => {
      setEvents((prev) => upsertById(prev, payload as EventItem));
    })
    .on('broadcast', { event: 'event-updated' }, ({ payload }) => {
      setEvents((prev) => upsertById(prev, payload as EventItem));
    })
    .on('broadcast', { event: 'event-deleted' }, ({ payload }) => {
      const { id } = payload as { id: string };
      setEvents((prev) => prev.filter((e) => e.id !== id));
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, []);
```

Initial load and subscription can race: merge the HTTP response into the current state (`setEvents((prev) => data.reduce(upsertById, prev))`) instead of replacing it.

Per-entity channel (admin live control): `supabase.channel(\`event:${eventId}\`)` listening to `activity-created`, with `[eventId]` in the dependency array.

## Rules

- The same item can arrive from the HTTP response and from the event: upsert by `id`.
- Never forget the cleanup; a missing `removeChannel` duplicates handlers on every re-mount (React Strict Mode mounts twice in dev).
- Event names and payload shapes come from the contract; reuse `types/models.ts` interfaces.
- Expose connection state (`realtimeStatus: 'connecting' | 'live' | 'offline'`) only if the UI shows it (e.g. the admin "ON SHIFT" pill).
- Test: simulate the event twice and assert one item; unmount and assert `removeChannel` was called (see `testing.md`).
