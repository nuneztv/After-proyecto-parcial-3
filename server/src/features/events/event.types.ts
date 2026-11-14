export const EVENT_CATEGORIES = ['music', 'party', 'rooftop', 'bar', 'concert'] as const;
export const EVENT_STATUSES = ['live', 'open', 'almost-full', 'closed'] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
// Stored status, returned unmapped: the admin app maps it to live/upcoming/closed itself
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type EventSection = 'happening' | 'tonight' | 'trending';

export interface Event {
  id: string;
  title: string;
  description: string;
  venueName: string;
  address: string;
  imageUrl: string | null;
  categories: string[];
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  latitude: number;
  longitude: number;
  capacity: number;
  occupied: number;
  rating: number;
  section: EventSection | null;
  mapLabel: string | null;
  createdAt: string;
}

export interface EventActivity {
  id: string;
  eventId: string;
  message: string;
  createdAt: string;
}

export interface EventStats {
  peopleNow: number;
  activeEvents: number;
  eventsToday: number;
  capacityPercent: number;
}

export interface EventFilters {
  search: string;
  category: EventCategory | 'all';
  status: EventStatus | 'all';
}

export interface CreateEventDTO {
  title: string;
  description: string;
  venueName: string;
  address: string;
  startsAt: string;
  endsAt: string | null;
  latitude: number;
  longitude: number;
  capacity: number;
  categories: EventCategory[];
  // Public URL returned by POST /api/uploads/images; ownership is checked in the controller
  imageUrl: string | null;
}

export interface OccupancyUpdate {
  event: Event;
  activity: EventActivity;
}

// The repository reports outcomes; the service turns them into HTTP errors
export type OccupancyUpdateResult =
  | { kind: 'ok'; event: Event; activity: EventActivity }
  | { kind: 'not-found' }
  | { kind: 'out-of-range' };
