import type { RealtimeChannel } from '@supabase/supabase-js';
import { getAdminRealtimeClient } from './supabase';

// Mirrors server/src/lib/realtime.ts: one public channel
export const EVENTS_CHANNEL = 'events';

export const REALTIME_EVENTS = {
  eventCreated: 'event-created',
  eventUpdated: 'event-updated',
  activityCreated: 'activity-created',
} as const;

// Messages are only signals. The channel is public (anyone with the publishable key can send to
// it), so nothing from a payload is displayed: handlers get ids and re-read the data from the API
export interface EventSignal {
  id: string;
}

export interface ActivitySignal {
  id: string;
  eventId: string;
}

export interface EventsChannelHandlers {
  // An event was created or updated: re-fetch it
  onEventChanged?: (signal: EventSignal) => void;
  // An activity row was written for an event: re-fetch the feeds that show it
  onActivityCreated?: (signal: ActivitySignal) => void;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

// Only the ids are kept; anything else in the payload is ignored
const toEventSignal = (payload: unknown): EventSignal | null => {
  const id = (payload as { id?: unknown } | null)?.id;
  return isUuid(id) ? { id } : null;
};

const toActivitySignal = (payload: unknown): ActivitySignal | null => {
  const { id, eventId } = (payload ?? {}) as { id?: unknown; eventId?: unknown };
  return isUuid(id) && isUuid(eventId) ? { id, eventId } : null;
};

// supabase.channel(topic) returns the same instance per topic, so two providers that each
// opened and removed 'events' would tear down each other's subscription. Instead there is one
// shared channel that fans out to every subscriber and is removed when the last one leaves.
const listeners = new Set<EventsChannelHandlers>();
let channel: RealtimeChannel | null = null;
let removing: Promise<unknown> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

const emit = <K extends keyof EventsChannelHandlers>(
  key: K,
  payload: Parameters<NonNullable<EventsChannelHandlers[K]>>[0],
): void => {
  listeners.forEach((handlers) => {
    const handler = handlers[key] as ((value: typeof payload) => void) | undefined;
    handler?.(payload);
  });
};

const openChannel = (): void => {
  const client = getAdminRealtimeClient();
  if (!client || channel || removing) return;

  channel = client
    .channel(EVENTS_CHANNEL)
    .on('broadcast', { event: REALTIME_EVENTS.eventCreated }, ({ payload }) => {
      const signal = toEventSignal(payload);
      if (signal) emit('onEventChanged', signal);
    })
    .on('broadcast', { event: REALTIME_EVENTS.eventUpdated }, ({ payload }) => {
      const signal = toEventSignal(payload);
      if (signal) emit('onEventChanged', signal);
    })
    .on('broadcast', { event: REALTIME_EVENTS.activityCreated }, ({ payload }) => {
      const signal = toActivitySignal(payload);
      if (signal) emit('onActivityCreated', signal);
    })
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Realtime channel ${EVENTS_CHANNEL}: ${status}`, err);
      }
    });
};

const closeChannel = (): void => {
  teardownTimer = null;
  const client = getAdminRealtimeClient();
  if (!client || !channel || listeners.size > 0) return;

  const current = channel;
  channel = null;
  removing = client
    .removeChannel(current)
    .catch((error: unknown) => {
      console.error(`Realtime channel ${EVENTS_CHANNEL}: remove failed`, error);
    })
    .finally(() => {
      removing = null;
      // Someone subscribed while the old channel was closing: open a fresh one
      if (listeners.size > 0) openChannel();
    });
};

// Returns the unsubscribe function for an effect cleanup. No-op when Realtime is not configured.
export const subscribeToEventsChannel = (handlers: EventsChannelHandlers): (() => void) => {
  if (!getAdminRealtimeClient()) return () => {};

  listeners.add(handlers);
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  openChannel();

  return () => {
    if (!listeners.delete(handlers) || listeners.size > 0) return;
    // Deferred so an immediate re-subscribe (Strict Mode, provider re-render with new
    // handlers) reuses the open channel instead of closing and reopening the socket
    if (!teardownTimer) teardownTimer = setTimeout(closeChannel, 0);
  };
};
