'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApi } from '@/lib/admin/axios';
import { getErrorMessage } from '@/lib/admin/errors';
import { toActivity } from '@/lib/admin/mappers';
import { subscribeToEventsChannel } from '@/lib/admin/realtime';
import type { Activity, ApiActivity } from '@/lib/admin/types';
import { useAdminAuth } from './AdminAuthProvider';
import { useToast } from './ToastProvider';

const RECENT_LIMIT = 20;
const RECENT_PREVIEW = 3;
const REFRESH_DEBOUNCE_MS = 250;

interface ActivityContextType {
  activities: Activity[];
  recentActivities: Activity[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  eventActivities: Activity[];
  eventActivityLoading: boolean;
  eventActivityError: string | null;
  loadEventActivity: (eventId: string) => Promise<void>;
  // Prepends an activity row the app just produced (e.g. an occupancy change); idempotent by id
  addActivity: (activity: Activity) => void;
}

const ActivityContext = createContext<ActivityContextType | null>(null);

// Newest first, like the API; the id breaks ties between rows written in the same instant
const byNewest = (a: Activity, b: Activity): number =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id);

// One row per id (the fetched copy wins), newest first
const mergeActivities = (fetched: Activity[], present: Activity[]): Activity[] => {
  const byId = new Map<string, Activity>();
  present.forEach((item) => byId.set(item.id, item));
  fetched.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort(byNewest);
};

export const ActivityProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAdminAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [activities, setActivities] = useState<Activity[]>([]);
  // Only an administrator's session loads anything
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState<string | null>(null);

  const [eventActivities, setEventActivities] = useState<Activity[]>([]);
  const [eventActivityLoading, setEventActivityLoading] = useState(false);
  const [eventActivityError, setEventActivityError] = useState<string | null>(null);

  // Incremented on every request, logout and unmount: older responses are ignored
  const listRequest = useRef(0);
  const eventRequest = useRef(0);
  // Event whose feed is in eventActivities: addActivity only touches that feed for its own event
  const loadedEventId = useRef<string | null>(null);
  // Incremented on logout and unmount: a background refresh that resolves afterwards is dropped
  const session = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventIds = useRef(new Set<string>());

  const reload = useCallback(async () => {
    const requestId = ++listRequest.current;
    setLoading(true);
    setError(null);

    try {
      const { data } = await adminApi.get<ApiActivity[]>('/api/events/activity', {
        params: { limit: RECENT_LIMIT },
      });
      if (requestId !== listRequest.current) return;
      // Keep realtime rows that arrived while this request was in flight
      setActivities((prev) => mergeActivities(data.map(toActivity), prev).slice(0, RECENT_LIMIT));
    } catch (err) {
      if (requestId !== listRequest.current) return;
      const message = getErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  }, [showToast]);

  const loadEventActivity = useCallback(
    async (eventId: string) => {
      const requestId = ++eventRequest.current;
      const switching = loadedEventId.current !== eventId;
      loadedEventId.current = eventId;
      setEventActivityLoading(true);
      setEventActivityError(null);
      // Do not show the previous event's feed while the new one loads; a reload of the same
      // event keeps its rows on screen
      if (switching) setEventActivities([]);

      try {
        const { data } = await adminApi.get<ApiActivity[]>(`/api/events/${eventId}/activity`);
        if (requestId !== eventRequest.current) return;
        // Rows added while the request was in flight (addActivity) may be newer than the response
        setEventActivities((prev) =>
          mergeActivities(
            data.map(toActivity),
            prev.filter((item) => item.eventId === eventId),
          ),
        );
      } catch (err) {
        if (requestId !== eventRequest.current) return;
        const message = getErrorMessage(err);
        setEventActivityError(message);
        showToast(message, 'error');
      } finally {
        if (requestId === eventRequest.current) setEventActivityLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    // Logged out or not an admin (e.g. the login page): never fetch. AdminState re-creates this
    // provider per user, so there is no previous session's data to drop here
    if (!isAdmin) return;
    // The fetch is the external system this effect syncs with: state only changes once the API
    // answers (the loading flag already starts true, so the first update is a no-op)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [isAdmin, user?.id, reload]);

  useEffect(() => {
    const lists = listRequest;
    const single = eventRequest;
    const background = session;
    return () => {
      lists.current++;
      single.current++;
      background.current++;
    };
  }, []);

  const addActivity = useCallback((activity: Activity) => {
    // Sorted, not just prepended: a late (older) broadcast must not show up as the newest row
    const prepend = (prev: Activity[]) => mergeActivities([activity], prev);

    setActivities((prev) => prepend(prev).slice(0, RECENT_LIMIT));
    if (loadedEventId.current === activity.eventId) setEventActivities(prepend);
  }, []);

  // A realtime signal only says "a row was written for event <eventId>": the feeds are re-read
  // from the API (merged by id, so a slower response never drops newer rows)
  const refreshFeeds = useCallback(async () => {
    refreshTimer.current = null;
    const sessionId = session.current;
    const signalled = new Set(pendingEventIds.current);
    pendingEventIds.current.clear();
    const loaded = loadedEventId.current;

    const requests: Promise<void>[] = [
      adminApi
        .get<ApiActivity[]>('/api/events/activity', { params: { limit: RECENT_LIMIT } })
        .then(({ data }) => {
          if (sessionId !== session.current) return;
          setActivities((prev) => mergeActivities(data.map(toActivity), prev).slice(0, RECENT_LIMIT));
        }),
    ];

    if (loaded && signalled.has(loaded)) {
      requests.push(
        adminApi.get<ApiActivity[]>(`/api/events/${loaded}/activity`).then(({ data }) => {
          if (sessionId !== session.current || loadedEventId.current !== loaded) return;
          setEventActivities((prev) =>
            mergeActivities(
              data.map(toActivity),
              prev.filter((item) => item.eventId === loaded),
            ),
          );
        }),
      );
    }

    // Background refresh: keep the last good feed, no toast for a missed signal
    const results = await Promise.allSettled(requests);
    results.forEach((result) => {
      if (result.status === 'rejected') console.error(result.reason);
    });
  }, []);

  // Occupancy changes by any admin (this browser included) arrive through Supabase Broadcast
  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = subscribeToEventsChannel({
      onActivityCreated: ({ eventId }) => {
        pendingEventIds.current.add(eventId);
        // A burst of check-ins (several doors) shares one round of requests
        if (!refreshTimer.current) {
          refreshTimer.current = setTimeout(() => void refreshFeeds(), REFRESH_DEBOUNCE_MS);
        }
      },
      // After a Realtime outage: re-read the recent feed and, if one is open, that event's feed
      // (rows are merged by id, so nothing already shown is dropped)
      onResync: () => {
        if (loadedEventId.current) pendingEventIds.current.add(loadedEventId.current);
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        void refreshFeeds();
      },
    });

    const timer = refreshTimer;
    const pending = pendingEventIds;
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current.clear();
    };
  }, [isAdmin, user?.id, refreshFeeds]);

  const recentActivities = useMemo(() => activities.slice(0, RECENT_PREVIEW), [activities]);

  return (
    <ActivityContext.Provider
      value={{
        activities,
        recentActivities,
        loading,
        error,
        reload,
        eventActivities,
        eventActivityLoading,
        eventActivityError,
        loadEventActivity,
        addActivity,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = () => {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used within ActivityProvider');
  return ctx;
};
