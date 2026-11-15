'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { useAxios } from './AxiosProvider';
import { useAuth } from './AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import { matchesDistance, matchesTime, toEventView, toServerQuery } from '@/lib/eventMappers';
import { subscribeToEventsChannel } from '@/lib/realtime';
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

const remove = (list: EventView[], id: string): EventView[] => list.filter((item) => item.id !== id);

// Same order as GET /api/events (starts_at, then id), so a new event lands where a reload
// would put it
const byStart = (a: EventView, b: EventView): number =>
  a.startsAt === b.startsAt ? a.id.localeCompare(b.id) : a.startsAt.localeCompare(b.startsAt);

// Replaces the event with the same id, or inserts it: safe to apply twice (the HTTP response
// and a Realtime re-fetch can deliver the same event)
const upsert = (list: EventView[], event: EventView): EventView[] =>
  list.some((item) => item.id === event.id)
    ? list.map((item) => (item.id === event.id ? event : item))
    : [...list, event].sort(byStart);

export const EventsProvider = ({ children }: { children: ReactNode }) => {
  const axios = useAxios();
  const { user } = useAuth();
  // The id, not the object: GET /api/auth/me replaces the user object without changing who it is
  const userId = user?.id;
  const [allEvents, setAllEvents] = useState<EventView[]>([]);
  // Last result of GET /api/events with server-side filters (kept while the next one loads)
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
  // Bumped by Realtime: re-runs the server-side filter so a changed event can enter or leave it
  const [liveVersion, setLiveVersion] = useState(0);
  // Query of the last filter request: a re-run for the same query refreshes silently
  const lastQueryKey = useRef('');
  // Latest Realtime re-fetch per event id: an older response for the same id is ignored
  const liveRequests = useRef(new Map<string, number>());

  useEffect(() => {
    allEventsRef.current = allEvents;
  }, [allEvents]);

  // silent: background refresh (Realtime resync) that must not flash the loading state
  const fetchAllEvents = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoadingList(true);
      setError('');

      try {
        const { data } = await axios.get<ApiEvent[]>('/api/events');
        setAllEvents(data.map((event) => toEventView(event)));
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [axios],
  );

  const reloadEvents = useCallback(() => fetchAllEvents(false), [fetchAllEvents]);

  useEffect(() => {
    if (!userId) return;
    // The fetch is the external system this effect syncs with: the list only changes once the
    // API answers (the loading flag is the only synchronous update)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadEvents();
  }, [userId, reloadEvents]);

  const serverQuery = useMemo(
    () => toServerQuery(filters),
    [filters],
  );
  const serverQueryKey = JSON.stringify(serverQuery);
  // null: a category the API does not know, so nothing can match. {}: no server-side filter
  const hasServerQuery = serverQuery !== null && Object.keys(serverQuery).length > 0;

  // search/category/status are filtered by the API; time and distance on the client below
  useEffect(() => {
    if (!userId) return;

    const requestId = ++listRequest.current;
    const query = JSON.parse(serverQueryKey) as ReturnType<typeof toServerQuery>;
    const silent = lastQueryKey.current === serverQueryKey;
    lastQueryKey.current = serverQueryKey;

    // No request (the list is derived below); a pending one, if any, is now outdated
    if (query === null || Object.keys(query).length === 0) return;

    const timer = window.setTimeout(async () => {
      if (!silent) setFiltering(true);
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
    }, query.search && !silent ? SEARCH_DEBOUNCE_MS : 0);

    return () => window.clearTimeout(timer);
    // liveVersion is a trigger only: a Realtime signal re-runs the current query
  }, [axios, userId, serverQueryKey, liveVersion]);

  const events = useMemo(() => {
    const base = serverQuery === null ? [] : hasServerQuery ? (serverMatches ?? allEvents) : allEvents;
    return base.filter(
      (event) => matchesTime(event, filters.time) && matchesDistance(event, filters.maxDistance),
    );
  }, [serverQuery, hasServerQuery, serverMatches, allEvents, filters.time, filters.maxDistance]);

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

  // A Realtime signal only says "event <id> changed": the data shown always comes from the API
  const refreshEvent = useCallback(
    async (id: string) => {
      const requestId = (liveRequests.current.get(id) ?? 0) + 1;
      liveRequests.current.set(id, requestId);
      const isLatest = () => liveRequests.current.get(id) === requestId;

      try {
        const { data } = await axios.get<ApiEvent>(`/api/events/${encodeURIComponent(id)}`);
        if (!isLatest()) return;

        const event = toEventView(data);
        setAllEvents((prev) => upsert(prev, event));
        if (detailRequest.current === id) setSelectedEvent(event);
      } catch (err) {
        if (!isLatest()) return;

        if (isAxiosError(err) && err.response?.status === 404) {
          // The event no longer exists: drop it from every list and from the open detail
          setAllEvents((prev) => remove(prev, id));
          setServerMatches((prev) => (prev ? remove(prev, id) : prev));
          if (detailRequest.current === id) {
            setSelectedEvent(null);
            setEventError(getErrorMessage(err));
          }
          return;
        }
        // The screen keeps the last known data; the next signal or resync tries again
        console.error(`Realtime refresh of event ${id} failed`, err);
      }
    },
    [axios],
  );

  // One subscription per signed-in user (the shared channel in lib/realtime.ts deduplicates
  // Strict Mode and re-created providers); removed when the provider unmounts or the user logs out
  useEffect(() => {
    if (!userId) return;

    return subscribeToEventsChannel({
      onEventChanged: ({ id }) => {
        void refreshEvent(id);
        setLiveVersion((version) => version + 1);
      },
      onResync: () => {
        void fetchAllEvents(true);
        if (detailRequest.current) void refreshEvent(detailRequest.current);
        setLiveVersion((version) => version + 1);
      },
    });
  }, [userId, refreshEvent, fetchAllEvents]);

  // A filter request that was overtaken by clearing the filter no longer counts as loading
  const loading = loadingList || (hasServerQuery && filtering);

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
