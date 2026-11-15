import type { RealtimeChannel } from '@supabase/supabase-js';
import { getRealtimeClient } from './supabase';

// Mirrors server/src/lib/realtime.ts: one public channel, id-only signals
export const EVENTS_CHANNEL = 'events';

export const REALTIME_EVENTS = {
  eventCreated: 'event-created',
  eventUpdated: 'event-updated',
} as const;

// The channel is public (anyone with the publishable key can send to it), so nothing from a
// payload is displayed: handlers get an id and re-read the event from the API
export interface EventSignal {
  id: string;
}

export interface EventsChannelHandlers {
  // An event was created or updated: re-fetch it
  onEventChanged: (signal: EventSignal) => void;
  // The channel came back after a connection failure. Broadcast does not replay messages, so
  // signals sent while it was down are lost: re-read what is shown from the API
  onResync: () => void;
}

// A dropped socket (network change, laptop sleep, dev-server reload) is normal: realtime-js
// reconnects and rejoins on its own. Only a channel that stays down this long is an error
const RECOVERY_GRACE_MS = 30_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only a valid id is kept; anything else in the payload is ignored
export const toEventSignal = (payload: unknown): EventSignal | null => {
  const id = (payload as { id?: unknown } | null)?.id;
  return typeof id === 'string' && UUID_PATTERN.test(id) ? { id } : null;
};

// supabase.channel(topic) returns the same instance per topic, so two subscribers that each
// opened and removed 'events' would tear down each other's subscription. Instead there is one
// shared channel that fans out to every subscriber and is removed when the last one leaves
const listeners = new Set<EventsChannelHandlers>();
let channel: RealtimeChannel | null = null;
let removing: Promise<unknown> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

// Connection state of the shared channel: set on the first failure, cleared when it rejoins
let failedSince: number | null = null;
let failedAttempts = 0;
let stillDownTimer: ReturnType<typeof setTimeout> | null = null;

const clearStillDownTimer = (): void => {
  if (stillDownTimer) clearTimeout(stillDownTimer);
  stillDownTimer = null;
};

const onSignal = (payload: unknown): void => {
  const signal = toEventSignal(payload);
  if (signal) listeners.forEach((handlers) => handlers.onEventChanged(signal));
};

const handleStatus = (status: string, err?: Error): void => {
  if (status === 'SUBSCRIBED') {
    if (failedSince === null) return;

    const downForMs = Date.now() - failedSince;
    const attempts = failedAttempts;
    failedSince = null;
    failedAttempts = 0;
    clearStillDownTimer();
    console.info(
      `Realtime channel ${EVENTS_CHANNEL}: reconnected after ${downForMs} ms (${attempts} failed attempts), resyncing`,
    );
    listeners.forEach((handlers) => handlers.onResync());
    return;
  }

  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    failedAttempts += 1;
    // realtime-js retries every few seconds and reports each failed attempt: warn once per
    // outage; the recovery or the error below report the totals
    if (failedSince !== null) return;

    failedSince = Date.now();
    console.warn(`Realtime channel ${EVENTS_CHANNEL}: ${status}, reconnecting...`, err);
    stillDownTimer = setTimeout(() => {
      stillDownTimer = null;
      if (failedSince === null) return;
      console.error(
        `Realtime channel ${EVENTS_CHANNEL}: still disconnected after ${RECOVERY_GRACE_MS / 1000} s (${failedAttempts} failed attempts); live updates are paused until it reconnects. First cause:`,
        err,
      );
    }, RECOVERY_GRACE_MS);
  }
};

const openChannel = (): void => {
  const client = getRealtimeClient();
  if (!client || channel || removing) return;

  channel = client
    .channel(EVENTS_CHANNEL)
    .on('broadcast', { event: REALTIME_EVENTS.eventCreated }, ({ payload }) => onSignal(payload))
    .on('broadcast', { event: REALTIME_EVENTS.eventUpdated }, ({ payload }) => onSignal(payload))
    .subscribe((status, err) => handleStatus(status, err));
};

const closeChannel = (): void => {
  teardownTimer = null;
  const client = getRealtimeClient();
  if (!client || !channel || listeners.size > 0) return;

  const current = channel;
  channel = null;
  // Closing on purpose (logout, unmount) is not a failure to report or recover from
  failedSince = null;
  failedAttempts = 0;
  clearStillDownTimer();
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

// Returns the unsubscribe function for an effect cleanup. No-op when Realtime is not configured
export const subscribeToEventsChannel = (handlers: EventsChannelHandlers): (() => void) => {
  if (!getRealtimeClient()) return () => {};

  listeners.add(handlers);
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  openChannel();

  return () => {
    if (!listeners.delete(handlers) || listeners.size > 0) return;
    // Deferred so an immediate re-subscribe (Strict Mode, a provider re-created for another
    // user) reuses the open channel instead of closing and reopening the socket
    if (!teardownTimer) teardownTimer = setTimeout(closeChannel, 0);
  };
};

// Test-only view of the shared state
export const getEventsChannelState = (): { listeners: number; open: boolean } => ({
  listeners: listeners.size,
  open: channel !== null,
});
