'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApi } from '@/lib/admin/axios';
import { getErrorMessage } from '@/lib/admin/errors';
import { toAfterEvent } from '@/lib/admin/mappers';
import type { AfterEvent, ApiEvent, EventStats, EventStatus } from '@/lib/admin/types';
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
}

const EventsContext = createContext<EventsContextType | null>(null);

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

  // Incremented on every request, logout and unmount: older responses are ignored
  const listRequest = useRef(0);
  const eventRequest = useRef(0);
  // Read by loadEvent without making it change on every reload (pages call it from an effect)
  const eventsRef = useRef<AfterEvent[]>([]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const reload = useCallback(async () => {
    const requestId = ++listRequest.current;
    setLoading(true);
    setError(null);

    try {
      const [eventsResponse, statsResponse] = await Promise.all([
        adminApi.get<ApiEvent[]>('/api/events'),
        adminApi.get<EventStats>('/api/events/stats'),
      ]);
      if (requestId !== listRequest.current) return;
      setEvents(eventsResponse.data.map(toAfterEvent));
      setStats(statsResponse.data);
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

  useEffect(() => {
    if (!isAdmin) {
      // Logged out or not an admin (e.g. the login page): never fetch, drop previous data
      listRequest.current++;
      eventRequest.current++;
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
    return () => {
      lists.current++;
      single.current++;
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
