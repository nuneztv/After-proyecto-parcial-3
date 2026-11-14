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

// Body the admin form sends for POST /api/events (all fields filled)
export const createEventBody = {
  title: 'Salsa Night',
  description: 'Live salsa band until late.',
  venueName: 'La Topa Tolondra',
  address: 'Calle 5 #13-27, Cali',
  startsAt: '2026-11-20T21:00:00-05:00',
  endsAt: '2026-11-21T03:00:00-05:00',
  latitude: 3.4495,
  longitude: -76.5385,
  capacity: 250,
  categories: ['music', 'party'],
};

export const createdEvent: Event = {
  id: 'e0000000-0000-4000-8000-000000000002',
  title: 'Salsa Night',
  description: 'Live salsa band until late.',
  venueName: 'La Topa Tolondra',
  address: 'Calle 5 #13-27, Cali',
  imageUrl: null,
  categories: ['music', 'party'],
  status: 'open',
  startsAt: '2026-11-21T02:00:00.000Z',
  endsAt: '2026-11-21T08:00:00.000Z',
  latitude: 3.4495,
  longitude: -76.5385,
  capacity: 250,
  occupied: 0,
  rating: 0,
  section: null,
  mapLabel: null,
  createdAt: '2026-11-14T12:00:00.000Z',
};

export const checkedInEvent: Event = { ...rooftopEvent, occupied: 343 };

export const checkInActivity: EventActivity = {
  id: 'a0000000-0000-4000-8000-000000000002',
  eventId: EVENT_ID,
  message: '+1 check-in at Rooftop Sessions (343/400)',
  createdAt: '2026-11-14T23:30:00.000Z',
};
