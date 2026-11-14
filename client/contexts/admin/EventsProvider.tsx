'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { adminApi } from '@/lib/admin/axios';
import { getErrorMessage } from '@/lib/admin/errors';
import { toActivity, toAfterEvent } from '@/lib/admin/mappers';
import { subscribeToEventsChannel } from '@/lib/admin/realtime';
import type {
  Activity,
  AfterEvent,
  ApiEvent,
  ApiOccupancyUpdate,
  CreateEventInput,
  EventStats,
  EventStatus,
} from '@/lib/admin/types';
import { useAdminAuth } from './AdminAuthProvider';
import { useToast } from './ToastProvider';

interface EventsContextType {
  events: AfterEvent[];
  liveEvents: AfterEvent[];
  eventsByStatus: Record<EventStatus, AfterEvent[]>;
  mapEvents: AfterEvent[];
  stats: EventStats | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  selectedEvent: AfterEvent | null;
  eventLoading: boolean;
  eventError: string | null;
  loadEvent: (id: string) => Promise<void>;
  creating: boolean;
  // Resolves to the created event, or null when the request failed (already toasted)
  createEvent: (input: CreateEventInput) => Promise<AfterEvent | null>;
  updatingOccupancy: boolean;
  // Resolves to the activity row the server wrote, or null when the request failed (already toasted)
  updateOccupancy: (id: string, delta: number) => Promise<Activity | null>;
}

const EventsContext = createContext<EventsContextType | null>(null);

// Same order as GET /api/events (starts_at ASC, id ASC)
const byStartsAt = (a: AfterEvent, b: AfterEvent): number =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id);

// Idempotent: the same event arrives from the HTTP response and from the realtime re-fetch
const upsertEvent = (list: AfterEvent[], item: AfterEvent): AfterEvent[] =>
  [...list.filter((event) => event.id !== item.id), item].sort(byStartsAt);

// Realtime bursts (several doors updating at once) share one stats refresh
const STATS_DEBOUNCE_MS = 300;

export const EventsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAdminAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [events, setEvents] = useState<AfterEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<AfterEvent | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [updatingOccupancy, setUpdatingOccupancy] = useState(false);

  // Incremented on every request, logout and unmount: older responses are ignored
  const listRequest = useRef(0);
  const eventRequest = useRef(0);
  const statsRequest = useRef(0);
  // Incremented on logout and unmount: a mutation that resolves afterwards does not touch state
  const session = useRef(0);
  // Read by loadEvent without making it change on every reload (pages call it from an effect)
  const eventsRef = useRef<AfterEvent[]>([]);
  // Id requested by the last loadEvent: a realtime update for it refreshes the detail view
  const selectedId = useRef<string | null>(null);
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest realtime re-fetch per event id: an older response for the same id is ignored
  const refreshSeq = useRef(0);
  const latestRefresh = useRef(new Map<string, number>());

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const reload = useCallback(async () => {
    const requestId = ++listRequest.current;
    // The full reload also returns stats: a pending stats-only refresh is now stale, and a
    // stats-only refresh started after this one wins over it
    const statsId = ++statsRequest.current;
    setLoading(true);
    setError(null);

    try {
      const [eventsResponse, statsResponse] = await Promise.all([
        adminApi.get<ApiEvent[]>('/api/events'),
        adminApi.get<EventStats>('/api/events/stats'),
      ]);
      if (requestId !== listRequest.current) return;
      setEvents(eventsResponse.data.map(toAfterEvent));
      if (statsId === statsRequest.current) setStats(statsResponse.data);
    } catch (err) {
      if (requestId !== listRequest.current) return;
      const message = getErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  }, [showToast]);

  const loadEvent = useCallback(
    async (id: string) => {
      const requestId = ++eventRequest.current;
      selectedId.current = id;
      setEventLoading(true);
      setEventError(null);
      // Show the cached card right away; the request below refreshes it
      setSelectedEvent(eventsRef.current.find((event) => event.id === id) ?? null);

      try {
        const { data } = await adminApi.get<ApiEvent>(`/api/events/${id}`);
        if (requestId !== eventRequest.current) return;
        setSelectedEvent(toAfterEvent(data));
      } catch (err) {
        if (requestId !== eventRequest.current) return;
        const message = getErrorMessage(err);
        setSelectedEvent(null);
        setEventError(message);
        showToast(message, 'error');
      } finally {
        if (requestId === eventRequest.current) setEventLoading(false);
      }
    },
    [showToast],
  );

  // Stats change after a mutation; refreshing them alone avoids reloading the whole list
  const reloadStats = useCallback(async () => {
    const requestId = ++statsRequest.current;

    try {
      const { data } = await adminApi.get<EventStats>('/api/events/stats');
      if (requestId !== statsRequest.current) return;
      setStats(data);
    } catch (err) {
      // The mutation already succeeded: keep the previous stats instead of a second error toast
      console.error(err);
    }
  }, []);

  const createEvent = useCallback(
    async (input: CreateEventInput): Promise<AfterEvent | null> => {
      const sessionId = session.current;
      setCreating(true);

      try {
        const { data } = await adminApi.post<ApiEvent>('/api/events', input);
        if (sessionId !== session.current) return null;

        const created = toAfterEvent(data);
        setEvents((prev) => upsertEvent(prev, created));
        void reloadStats();
        showToast('Event created', 'success');
        return created;
      } catch (err) {
        if (sessionId === session.current) showToast(getErrorMessage(err), 'error');
        return null;
      } finally {
        if (sessionId === session.current) setCreating(false);
      }
    },
    [reloadStats, showToast],
  );

  const updateOccupancy = useCallback(
    async (id: string, delta: number): Promise<Activity | null> => {
      const sessionId = session.current;
      setUpdatingOccupancy(true);

      try {
        const { data } = await adminApi.patch<ApiOccupancyUpdate>(`/api/events/${id}/occupancy`, {
          delta,
        });
        if (sessionId !== session.current) return null;

        const updated = toAfterEvent(data.event);
        setEvents((prev) => prev.map((event) => (event.id === id ? updated : event)));
        // A GET /api/events/:id still in flight was sent before this change: drop its
        // (older) response so it cannot overwrite the fresh count
        eventRequest.current++;
        setEventLoading(false);
        setSelectedEvent(updated);
        void reloadStats();
        return toActivity(data.activity);
      } catch (err) {
        // 409 carries "Occupancy must stay between 0 and capacity" from the API
        if (sessionId === session.current) showToast(getErrorMessage(err), 'error');
        return null;
      } finally {
        if (sessionId === session.current) setUpdatingOccupancy(false);
      }
    },
    [reloadStats, showToast],
  );

  const scheduleStatsReload = useCallback(() => {
    if (statsTimer.current) clearTimeout(statsTimer.current);
    statsTimer.current = setTimeout(() => {
      statsTimer.current = null;
      void reloadStats();
    }, STATS_DEBOUNCE_MS);
  }, [reloadStats]);

  // A realtime signal only says "event <id> changed": the data shown always comes from the API
  const refreshEvent = useCallback(async (id: string) => {
    const sessionId = session.current;
    const seq = ++refreshSeq.current;
    latestRefresh.current.set(id, seq);
    // This request is newer than any loadEvent still in flight for the open detail view
    const detailRequest = selectedId.current === id ? ++eventRequest.current : null;

    try {
      const { data } = await adminApi.get<ApiEvent>(`/api/events/${id}`);
      if (sessionId !== session.current || latestRefresh.current.get(id) !== seq) return;

      const fresh = toAfterEvent(data);
      setEvents((prev) => upsertEvent(prev, fresh));
      if (detailRequest !== null && detailRequest === eventRequest.current) {
        setSelectedEvent(fresh);
        setEventError(null);
        setEventLoading(false);
      }
    } catch (err) {
      if (sessionId !== session.current || latestRefresh.current.get(id) !== seq) return;
      if (isAxiosError(err) && err.response?.status === 404) {
        // Deleted (or never existed: a forged signal): it must not stay in the list
        setEvents((prev) => prev.filter((event) => event.id !== id));
        return;
      }
      // Background refresh: the list keeps its last good data, no toast for a missed signal
      console.error(err);
    } finally {
      if (latestRefresh.current.get(id) === seq) latestRefresh.current.delete(id);
    }
  }, []);

  // Changes made by any admin (this browser included) arrive through Supabase Broadcast
  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = subscribeToEventsChannel({
      onEventChanged: ({ id }) => {
        void refreshEvent(id);
        scheduleStatsReload();
      },
    });

    const timer = statsTimer;
    const refreshes = latestRefresh;
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      refreshes.current.clear();
    };
  }, [isAdmin, user?.id, refreshEvent, scheduleStatsReload]);

  useEffect(() => {
    if (!isAdmin) {
      // Logged out or not an admin (e.g. the login page): never fetch, drop previous data
      listRequest.current++;
      eventRequest.current++;
      statsRequest.current++;
      session.current++;
      selectedId.current = null;
      setCreating(false);
      setUpdatingOccupancy(false);
      setEvents([]);
      setStats(null);
      setError(null);
      setLoading(false);
      setSelectedEvent(null);
      setEventError(null);
      setEventLoading(false);
      return;
    }

    void reload();
  }, [isAdmin, user?.id, reload]);

  useEffect(() => {
    const lists = listRequest;
    const single = eventRequest;
    const statsOnly = statsRequest;
    const mutations = session;
    return () => {
      lists.current++;
      single.current++;
      statsOnly.current++;
      mutations.current++;
    };
  }, []);

  const liveEvents = useMemo(() => events.filter((event) => event.status === 'live'), [events]);

  const eventsByStatus = useMemo<Record<EventStatus, AfterEvent[]>>(
    () => ({
      live: liveEvents,
      upcoming: events.filter((event) => event.status === 'upcoming'),
      closed: events.filter((event) => event.status === 'closed'),
    }),
    [events, liveEvents],
  );

  const mapEvents = useMemo(() => events.filter((event) => event.status !== 'closed'), [events]);

  return (
    <EventsContext.Provider
      value={{
        events,
        liveEvents,
        eventsByStatus,
        mapEvents,
        stats,
        loading,
        error,
        reload,
        selectedEvent,
        eventLoading,
        eventError,
        loadEvent,
        creating,
        createEvent,
        updatingOccupancy,
        updateOccupancy,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used within EventsProvider');
  return ctx;
};
