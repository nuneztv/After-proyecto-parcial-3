import { Event } from '../events/event.types';

// A favorite of the current user, with its event nested by SQL (json_build_object)
export interface SavedEvent {
  eventId: string;
  savedAt: string;
  event: Event;
}
