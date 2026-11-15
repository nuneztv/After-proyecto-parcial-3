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

// The event a feed row belongs to, nested by SQL (json_build_object) in the read queries
export interface ActivityEventSummary {
  id: string;
  title: string;
  status: EventStatus;
}

// Read endpoints (GET /api/events/activity, GET /api/events/:id/activity) add `event`; the
// fields of EventActivity stay unchanged, so the contract only grows
export interface EventActivityWithEvent extends EventActivity {
  event: ActivityEventSummary;
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

// PATCH /api/events/:id: omitted fields stay unchanged. Status, occupied (own endpoint) and
// categories are not editable here. address: null means "reset to the stored venue name"
export type UpdateEventDTO = Partial<Omit<CreateEventDTO, 'categories' | 'address'>> & {
  address?: string | null;
};

export type UpdateEventResult =
  | { kind: 'ok'; event: Event }
  | { kind: 'not-found' }
  | { kind: 'capacity-below-occupancy'; occupied: number }
  | { kind: 'ends-before-start' }
  | { kind: 'image-not-allowed' };

export interface OccupancyUpdate {
  event: Event;
  activity: EventActivity;
}

// The repository reports outcomes; the service turns them into HTTP errors
export type OccupancyUpdateResult =
  | { kind: 'ok'; event: Event; activity: EventActivity }
  | { kind: 'not-found' }
  | { kind: 'out-of-range' };
