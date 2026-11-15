'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useEvents } from './EventsProvider';
import { useSavedEvents } from './SavedEventsProvider';
import { useToast } from './ToastProvider';
import {
  diffEventNotifications,
  mergeNotifications,
  snapshotEvents,
} from '@/lib/notifications';
import type { AppNotification, EventSnapshot } from '@/lib/notifications';

interface NotificationsContextType {
  // Newest first; kept for this session only
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

// Event updates for the user. No subscription of its own: EventsProvider already listens to the
// Supabase Realtime "events" channel and re-reads each changed event, so this provider compares
// the list before and after to tell the user what changed (one socket, nothing left open)
export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { allEvents } = useEvents();
  const { savedIds } = useSavedEvents();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // null until the first list arrives: loading the events is not a change to notify
  const snapshot = useRef<EventSnapshot | null>(null);

  useEffect(() => {
    if (snapshot.current === null) {
      if (allEvents.length > 0) snapshot.current = snapshotEvents(allEvents);
      return;
    }

    const incoming = diffEventNotifications(snapshot.current, allEvents, new Set(savedIds));
    // Updated before anything else, so running this effect twice cannot notify twice
    snapshot.current = snapshotEvents(allEvents);
    if (incoming.length === 0) return;

    setNotifications((prev) => mergeNotifications(prev, incoming));
    incoming.forEach((item) => showToast(item.message, 'info'));
  }, [allEvents, savedIds, showToast]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => (item.read ? item : { ...item, read: true })));
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, markAllRead }),
    [notifications, unreadCount, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};
