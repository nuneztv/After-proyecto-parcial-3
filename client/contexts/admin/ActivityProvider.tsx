'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApi } from '@/lib/admin/axios';
import { getErrorMessage } from '@/lib/admin/errors';
import { toActivity } from '@/lib/admin/mappers';
import type { Activity, ApiActivity } from '@/lib/admin/types';
import { useAdminAuth } from './AdminAuthProvider';
import { useToast } from './ToastProvider';

const RECENT_LIMIT = 20;
const RECENT_PREVIEW = 3;

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
}

const ActivityContext = createContext<ActivityContextType | null>(null);

export const ActivityProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAdminAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventActivities, setEventActivities] = useState<Activity[]>([]);
  const [eventActivityLoading, setEventActivityLoading] = useState(false);
  const [eventActivityError, setEventActivityError] = useState<string | null>(null);

  // Incremented on every request, logout and unmount: older responses are ignored
  const listRequest = useRef(0);
  const eventRequest = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++listRequest.current;
    setLoading(true);
    setError(null);

    try {
      const { data } = await adminApi.get<ApiActivity[]>('/api/events/activity', {
        params: { limit: RECENT_LIMIT },
      });
      if (requestId !== listRequest.current) return;
      setActivities(data.map(toActivity));
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
      setEventActivityLoading(true);
      setEventActivityError(null);
      // Do not show the previous event's feed while the new one loads
      setEventActivities([]);

      try {
        const { data } = await adminApi.get<ApiActivity[]>(`/api/events/${eventId}/activity`);
        if (requestId !== eventRequest.current) return;
        setEventActivities(data.map(toActivity));
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
    if (!isAdmin) {
      // Logged out or not an admin (e.g. the login page): never fetch, drop previous data
      listRequest.current++;
      eventRequest.current++;
      setActivities([]);
      setError(null);
      setLoading(false);
      setEventActivities([]);
      setEventActivityError(null);
      setEventActivityLoading(false);
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
