import { isSupabaseConfigured } from '../config';
import { getSupabase } from './supabase';

// Single public channel for the admin app: events and occupancy are public info in After
export const EVENTS_CHANNEL = 'events';

export const REALTIME_EVENTS = {
  eventCreated: 'event-created',
  eventUpdated: 'event-updated',
  activityCreated: 'activity-created',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

// Broadcasts are only signals: the channel is public (anyone with the publishable key can send
// to it), so payloads carry ids and the clients re-read the real data from the API
export interface EventSignal {
  id: string;
}

export interface ActivitySignal {
  id: string;
  eventId: string;
}

// Fire-and-forget: a failed broadcast must never fail the HTTP request, so this never throws.
// httpSend posts to the REST endpoint, so the channel is never subscribed (no server websocket).
// The channel is not removed afterwards on purpose: supabase.channel() returns the same instance
// per topic, so removing it here would tear it down under a concurrent broadcast
// (event-updated + activity-created are sent together). One idle object per topic is the cost.
export const broadcast = async (
  channelName: string,
  event: string,
  payload: unknown,
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const result = await getSupabase().channel(channelName).httpSend(event, payload);

    if (!result.success) {
      console.error(`Broadcast ${event} on ${channelName} failed (${result.status})`, result.error);
    }
  } catch (error) {
    console.error(`Broadcast ${event} on ${channelName} failed`, error);
  }
};
