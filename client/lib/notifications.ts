import type { EventStatus, EventView } from '@/types/models';

export interface AppNotification {
  // Same change, same id: applying a change twice never creates a second notification
  id: string;
  eventId: string;
  message: string;
  createdAt: number;
  read: boolean;
}

// What is remembered of each event to detect changes
export type EventSnapshot = Map<string, { status: EventStatus; title: string }>;

const STATUS_LABELS: Record<EventStatus, string> = {
  live: 'LIVE',
  open: 'open',
  'almost-full': 'almost full',
  closed: 'closed',
};

export const snapshotEvents = (events: EventView[]): EventSnapshot =>
  new Map(events.map((event) => [event.id, { status: event.status, title: event.title }]));

// Notifications for the changes between two versions of the event list (EventsProvider updates
// the list when a Realtime signal arrives): a new event, and a status change of a saved event.
// Occupancy changes are left out on purpose: every check-in would be a notification
export const diffEventNotifications = (
  previous: EventSnapshot,
  events: EventView[],
  savedIds: ReadonlySet<string>,
  now: number = Date.now(),
): AppNotification[] => {
  const notifications: AppNotification[] = [];

  for (const event of events) {
    const before = previous.get(event.id);

    if (!before) {
      notifications.push({
        id: `${event.id}:created`,
        eventId: event.id,
        message: `New event: ${event.title} at ${event.venueName}`,
        createdAt: now,
        read: false,
      });
    } else if (before.status !== event.status && savedIds.has(event.id)) {
      notifications.push({
        id: `${event.id}:${event.status}:${now}`,
        eventId: event.id,
        message: `${event.title} is now ${STATUS_LABELS[event.status]}`,
        createdAt: now,
        read: false,
      });
    }
  }

  return notifications;
};

export const MAX_NOTIFICATIONS = 20;

// Newest first, without repeating an id, capped
export const mergeNotifications = (
  current: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] => {
  const known = new Set(current.map((item) => item.id));
  const fresh = incoming.filter((item) => !known.has(item.id));
  return [...fresh.reverse(), ...current].slice(0, MAX_NOTIFICATIONS);
};
