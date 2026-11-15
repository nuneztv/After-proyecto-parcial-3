import type { AfterEvent, ApiEvent, EventDraft } from '@/lib/admin/types';

// Hand-written shapes shared by the admin pure-logic tests

export const EVENT_ID = '3f1c2a4e-8b7d-4c3a-9e2f-1a2b3c4d5e6f';

export const IMAGE_URL =
  'https://test-project.supabase.co/storage/v1/object/public/event-images/user-1/a.png';

// Starts Fri Nov 20 2026 at 10:00 pm Bogota (03:00 UTC next day), ends 3:00 am Bogota
export const apiEvent: ApiEvent = {
  id: EVENT_ID,
  title: 'Rooftop Sessions',
  description: 'House music on the roof',
  venueName: 'Skyline Bar',
  address: 'Calle 5 #13-27, Cali',
  imageUrl: IMAGE_URL,
  categories: ['music'],
  status: 'almost-full',
  startsAt: '2026-11-21T03:00:00.000Z',
  endsAt: '2026-11-21T08:00:00.000Z',
  latitude: 3.4495,
  longitude: -76.5385,
  capacity: 400,
  occupied: 342,
  rating: 4.5,
  section: 'tonight',
  mapLabel: null,
  createdAt: '2026-11-01T15:00:00.000Z',
};

export const afterEvent: AfterEvent = {
  id: EVENT_ID,
  name: 'Rooftop Sessions',
  description: 'House music on the roof',
  date: 'Fri, Nov 20, 2026',
  startTime: '10:00 pm',
  endTime: '3:00 am',
  location: 'Skyline Bar',
  address: 'Calle 5 #13-27, Cali',
  startsAt: '2026-11-21T03:00:00.000Z',
  endsAt: '2026-11-21T08:00:00.000Z',
  latitude: 3.4495,
  longitude: -76.5385,
  image: IMAGE_URL,
  imageUrl: IMAGE_URL,
  status: 'upcoming',
  attendees: 342,
  capacity: 400,
};

export const validDraft: EventDraft = {
  title: 'Rooftop Sessions',
  description: 'House music on the roof',
  venueName: 'Skyline Bar',
  date: '2026-11-20',
  time: '22:00',
  endDate: '',
  endTime: '',
  capacity: '400',
  location: { latitude: 3.4495, longitude: -76.5385 },
  imageUrl: null,
};
