import { Event, EventActivity, EventStats } from '../../src/features/events/event.types';

// Hand-written event rows shaped like the repository output (camelCase, ISO dates)

export const EVENT_ID = 'e0000000-0000-4000-8000-000000000001';
export const MISSING_EVENT_ID = 'e0000000-0000-4000-8000-000000000099';

export const rooftopEvent: Event = {
  id: EVENT_ID,
  title: 'Rooftop Sessions',
  description: 'Sunset rooftop party with resident DJs.',
  venueName: 'Skyline Rooftop',
  address: 'Cra 8a #22-26, Cali',
  imageUrl: '/images/events/rooftop-sessions.jpg',
  categories: ['rooftop', 'party'],
  status: 'live',
  startsAt: '2026-11-14T23:00:00.000Z',
  endsAt: '2026-11-15T07:00:00.000Z',
  latitude: 3.4516,
  longitude: -76.532,
  capacity: 400,
  occupied: 342,
  rating: 4.8,
  section: 'happening',
  mapLabel: 'Rooftop',
  createdAt: '2026-11-14T00:00:00.000Z',
};

export const rooftopActivity: EventActivity = {
  id: 'a0000000-0000-4000-8000-000000000001',
  eventId: EVENT_ID,
  message: 'Rooftop Sessions is live at Skyline Rooftop',
  createdAt: '2026-11-14T23:00:00.000Z',
};

// Values the stats CTE returns on the seed data
export const seedStats: EventStats = {
  peopleNow: 572,
  activeEvents: 2,
  eventsToday: 5,
  capacityPercent: 57,
};
