'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAxios } from './AxiosProvider';
import { useAuth } from './AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import { matchesDistance, matchesTime, toEventView, toServerQuery } from '@/lib/eventMappers';
import type { ApiEvent, EventFilters, EventView } from '@/types/models';

export const DEFAULT_FILTERS: EventFilters = {
  search: '',
  category: 'all',
  status: 'all',
  time: 'all',
  maxDistance: 5,
};

// Typing in the search box sends one request when the user pauses, not one per key
const SEARCH_DEBOUNCE_MS = 300;

interface EventsContextType {
  // Every event, unfiltered (map, saved events, detail fallback)
  allEvents: EventView[];
  // allEvents narrowed by the current filters
  events: EventView[];
  happening: EventView[];
  tonight: EventView[];
  trending: EventView | null;
  filters: EventFilters;
  setFilters: (next: Partial<EventFilters>) => void;
  resetFilters: () => void;
  // the list (or a filtered list) is loading
  loading: boolean;
  error: string;
  reloadEvents: () => Promise<void>;
  selectedEvent: EventView | null;
  loadingEvent: boolean;
  eventError: string;
  loadEventById: (id: string) => Promise<EventView | null>;
}

const EventsContext = createContext<EventsContextType | null>(null);

// Replaces the event with the same id, or appends it: safe to apply twice
const upsert = (list: EventView[], event: EventView): EventView[] =>
  list.some((item) => item.id === event.id)
    ? list.map((item) => (item.id === event.id ? event : item))
    : [...list, event];

export const EventsProvider = ({ children }: { children: ReactNode }) => {
  const axios = useAxios();
  const { user } = useAuth();
  // The id, not the object: GET /api/auth/me replaces the user object without changing who it is
  const userId = user?.id;
  const [allEvents, setAllEvents] = useState<EventView[]>([]);
  // Result of GET /api/events with the server-side filters; null = no server filter applied
  const [serverMatches, setServerMatches] = useState<EventView[] | null>(null);
  const [filters, setFiltersState] = useState<EventFilters>(DEFAULT_FILTERS);
  const [loadingList, setLoadingList] = useState(false);
  // a GET /api/events with server-side filters is in flight
  const [filtering, setFiltering] = useState(false);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventView | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [eventError, setEventError] = useState('');
  // Only the latest list/detail request may update the state (responses can arrive out of order)
  const listRequest = useRef(0);
  const detailRequest = useRef('');
  const allEventsRef = useRef<EventView[]>([]);

  useEffect(() => {
    allEventsRef.current = allEvents;
  }, [allEvents]);

  const reloadEvents = useCallback(async () => {
    setLoadingList(true);
    setError('');

    try {
      const { data } = await axios.get<ApiEvent[]>('/api/events');
      setAllEvents(data.map((event) => toEventView(event)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingList(false);
    }
  }, [axios]);

  useEffect(() => {
    if (!userId) return;
    void reloadEvents();
  }, [userId, reloadEvents]);

  const serverQuery = useMemo(
    () => toServerQuery(filters),
    [filters],
  );
  const serverQueryKey = JSON.stringify(serverQuery);

  // search/category/status are filtered by the API; time and distance on the client below
  useEffect(() => {
    if (!userId) return;

    const requestId = ++listRequest.current;
    const query = JSON.parse(serverQueryKey) as ReturnType<typeof toServerQuery>;

    if (query === null || Object.keys(query).length === 0) {
      // No request: a pending one (if any) is now outdated
      setFiltering(false);
      setServerMatches(query === null ? [] : null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setFiltering(true);
      setError('');

      try {
        const { data } = await axios.get<ApiEvent[]>('/api/events', { params: query });
        if (requestId === listRequest.current) {
          setServerMatches(data.map((event) => toEventView(event)));
        }
      } catch (err) {
        if (requestId === listRequest.current) setError(getErrorMessage(err));
      } finally {
        if (requestId === listRequest.current) setFiltering(false);
      }
    }, query.search ? SEARCH_DEBOUNCE_MS : 0);

    return () => window.clearTimeout(timer);
  }, [axios, userId, serverQueryKey]);

  const events = useMemo(
    () =>
      (serverMatches ?? allEvents).filter(
        (event) => matchesTime(event, filters.time) && matchesDistance(event, filters.maxDistance),
      ),
    [serverMatches, allEvents, filters.time, filters.maxDistance],
  );

  const happening = useMemo(() => events.filter((event) => event.section === 'happening'), [events]);
  const tonight = useMemo(() => events.filter((event) => event.section === 'tonight'), [events]);
  const trending = useMemo(
    () => events.find((event) => event.section === 'trending') ?? null,
    [events],
  );

  const setFilters = useCallback((next: Partial<EventFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);

  const loadEventById = useCallback(
    async (id: string) => {
      detailRequest.current = id;
      setLoadingEvent(true);
      setEventError('');
      // Show the cached copy at once; the request below refreshes it
      setSelectedEvent(allEventsRef.current.find((event) => event.id === id) ?? null);

      try {
        const { data } = await axios.get<ApiEvent>(`/api/events/${encodeURIComponent(id)}`);
        const event = toEventView(data);
        if (detailRequest.current !== id) return event;

        setSelectedEvent(event);
        setAllEvents((prev) => upsert(prev, event));
        return event;
      } catch (err) {
        if (detailRequest.current === id) {
          setSelectedEvent(null);
          setEventError(getErrorMessage(err));
        }
        return null;
      } finally {
        if (detailRequest.current === id) setLoadingEvent(false);
      }
    },
    [axios],
  );

  const loading = loadingList || filtering;

  const value = useMemo(
    () => ({
      allEvents,
      events,
      happening,
      tonight,
      trending,
      filters,
      setFilters,
      resetFilters,
      loading,
      error,
      reloadEvents,
      selectedEvent,
      loadingEvent,
      eventError,
      loadEventById,
    }),
    [
      allEvents,
      events,
      happening,
      tonight,
      trending,
      filters,
      setFilters,
      resetFilters,
      loading,
      error,
      reloadEvents,
      selectedEvent,
      loadingEvent,
      eventError,
      loadEventById,
    ],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
};

export const useEvents = () => {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used within EventsProvider');
  return ctx;
};
