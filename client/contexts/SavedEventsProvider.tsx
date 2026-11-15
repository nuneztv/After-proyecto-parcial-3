'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAxios } from './AxiosProvider';
import { useAuth } from './AuthProvider';
import { useEvents } from './EventsProvider';
import { useToast } from './ToastProvider';
import { getErrorMessage } from '@/lib/errors';
import { toEventView } from '@/lib/eventMappers';
import type { EventView, SavedEvent } from '@/types/models';

interface SavedEventsContextType {
  // Ids of the user's favorites, most recently saved first
  savedIds: string[];
  savedEvents: EventView[];
  // One entry per venue of the saved events (the "Venues" tab)
  savedVenues: EventView[];
  loading: boolean;
  // Loading the list failed (a failed save/unsave is reported with a toast instead)
  error: string;
  // Event ids whose save/unsave request is in flight
  pendingIds: string[];
  toggleSaved: (eventId: string) => Promise<void>;
  reloadSaved: () => Promise<void>;
}

const SavedEventsContext = createContext<SavedEventsContextType | null>(null);

export const SavedEventsProvider = ({ children }: { children: ReactNode }) => {
  const axios = useAxios();
  const { user } = useAuth();
  // The id, not the object: GET /api/auth/me replaces the user object without changing who it is
  const userId = user?.id;
  const { allEvents } = useEvents();
  const { showToast } = useToast();
  const [saved, setSaved] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  // A ref, not the state: two quick clicks on the same heart must not send two requests
  const inFlight = useRef(new Set<string>());

  // The server is the source of truth: favorites follow the account across devices and sessions
  const loadSaved = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      setError('');

      try {
        const { data } = await axios.get<SavedEvent[]>('/api/saved-events');
        setSaved(data.map((row) => toEventView(row.event)));
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [axios],
  );

  const reloadSaved = useCallback(() => loadSaved(false), [loadSaved]);

  useEffect(() => {
    if (!userId) return;
    // The fetch is the external system this effect syncs with: favorites only change once the
    // API answers (the loading flag is the only synchronous update)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadSaved();

    // Back to this tab: pick up favorites changed on another device in the meantime
    const onVisible = () => {
      if (document.visibilityState === 'visible' && inFlight.current.size === 0) {
        void loadSaved(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, reloadSaved, loadSaved]);

  const savedIds = useMemo(() => saved.map((event) => event.id), [saved]);

  // Live data (Realtime occupancy, edits) from EventsProvider wins over the copy loaded here
  const savedEvents = useMemo(() => {
    const live = new Map(allEvents.map((event) => [event.id, event]));
    return saved.map((event) => live.get(event.id) ?? event);
  }, [saved, allEvents]);

  // Optimistic: the heart changes at once and is rolled back if the API refuses
  const toggleSaved = useCallback(
    async (eventId: string) => {
      if (!userId || inFlight.current.has(eventId)) return;

      const previous = saved.find((item) => item.id === eventId);
      const event = previous ?? allEvents.find((item) => item.id === eventId);
      if (!event) return;

      const without = (list: EventView[]) => list.filter((item) => item.id !== eventId);
      const withEvent = (list: EventView[]) => [event, ...without(list)];

      inFlight.current.add(eventId);
      setPendingIds((prev) => [...prev, eventId]);
      setSaved(previous ? without : withEvent);

      try {
        const url = `/api/saved-events/${encodeURIComponent(eventId)}`;
        if (previous) await axios.delete(url);
        else await axios.put(url);
        showToast(previous ? 'Removed from saved events' : 'Saved to your events', 'success');
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
        // Undo only this change; other favorites toggled meanwhile stay as they are
        setSaved(previous ? withEvent : without);
      } finally {
        inFlight.current.delete(eventId);
        setPendingIds((prev) => prev.filter((id) => id !== eventId));
      }
    },
    [axios, userId, allEvents, saved, showToast],
  );

  const savedVenues = useMemo(() => {
    const seen = new Set<string>();
    return savedEvents.filter((event) => {
      if (seen.has(event.venueName)) return false;
      seen.add(event.venueName);
      return true;
    });
  }, [savedEvents]);

  const value = useMemo(
    () => ({ savedIds, savedEvents, savedVenues, loading, error, pendingIds, toggleSaved, reloadSaved }),
    [savedIds, savedEvents, savedVenues, loading, error, pendingIds, toggleSaved, reloadSaved],
  );

  return <SavedEventsContext.Provider value={value}>{children}</SavedEventsContext.Provider>;
};

export const useSavedEvents = () => {
  const ctx = useContext(SavedEventsContext);
  if (!ctx) throw new Error('useSavedEvents must be used within SavedEventsProvider');
  return ctx;
};
