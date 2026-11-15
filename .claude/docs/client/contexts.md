# Providers (contexts)

A provider = state + API actions for one domain, exposed through a `useX` hook. File: `contexts/<Name>Provider.tsx` (admin: `contexts/admin/<Name>Provider.tsx`). The target provider map for After is in `.claude/docs/project/domain.md`.

## Template

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAxios } from './AxiosProvider';
import { useToast } from './ToastProvider';
import { getErrorMessage } from '@/lib/errors';
import type { EventItem } from '@/types/models';

interface EventsContextValue {
  events: EventItem[];
  loading: boolean;
  creating: boolean;
  deletingId: string | null;
  error: string | null;
  reload: () => Promise<void>;
  createEvent: (input: CreateEventInput) => Promise<EventItem | null>;
  deleteEvent: (id: string) => Promise<void>;
}

const EventsContext = createContext<EventsContextValue | null>(null);

const appendById = (list: EventItem[], item: EventItem) =>
  list.some((e) => e.id === item.id) ? list : [...list, item];

export const EventsProvider = ({ children }: { children: ReactNode }) => {
  const api = useAxios();
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get<EventItem[]>('/api/events');
      setEvents(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createEvent = async (input: CreateEventInput) => {
    setCreating(true);

    try {
      const { data } = await api.post<EventItem>('/api/events', input);
      setEvents((prev) => appendById(prev, data));
      showToast('Event created', 'success');
      return data;
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
      return null;
    } finally {
      setCreating(false);
    }
  };

  const deleteEvent = async (id: string) => {
    setDeletingId(id);

    try {
      await api.delete(`/api/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      showToast('Event deleted', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <EventsContext.Provider
      value={{ events, loading, creating, deletingId, error, reload, createEvent, deleteEvent }}
    >
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventsContext);

  if (!context) {
    throw new Error('useEvents must be used within EventsProvider');
  }

  return context;
};
```

## Error handling decision (one per app)

Providers catch API errors and call `showToast(getErrorMessage(err), 'error')`; components never `try/catch` API calls. Initial-load errors are also kept in `error` so pages can render `EmptyState` with a retry. Actions return a value (`EventItem | null`, `boolean`) so a form can decide to redirect.

## Variants

- **Derived data lives in the provider**, not in pages: `happening`, `tonight`, `trending`, `filteredEvents` are `useMemo`s exposed in the value.
- **Param-driven provider** (detail pages): `EventDetailProvider({ eventId })`, effect depends on `[eventId]`.
- **Idempotent updates** (needed with realtime): always `appendById` / replace by id.
- **Per-user reset:** feature providers that depend on the session render under `key={user?.id ?? 'anonymous'}` so state resets on login/logout.
- **Depends on auth:** `const { user } = useAuth();` and fetch only when `user` exists.
- **Toasts:** `ToastProvider` exposes `showToast(message, type)`; keep timers in a ref and clear them on unmount.

## Mounting

```tsx
// components/Providers.tsx (root, used by app/layout.tsx)
<ToastProvider>
  <AxiosProvider>
    <AuthProvider>
      {children}
    </AuthProvider>
  </AxiosProvider>
</ToastProvider>
```

User feature providers (`EventsProvider`, `SavedEventsProvider`, `PaymentsProvider`) go in the pages/layouts that need them, keyed by user id. Admin providers stay in `contexts/admin/AdminState.tsx` (mounted by `app/admin/layout.tsx`).

## Why providers instead of prop drilling (for the oral defense)

- The same data (events, session) is used by distant components (BottomNav, cards, map); passing it through every level couples components that do not use it.
- One place owns loading/error/realtime for a domain, so pages stay declarative and testable.
- Splitting providers by feature avoids re-rendering the whole tree when unrelated state changes (the current `DataProvider` re-renders everything on any change).
