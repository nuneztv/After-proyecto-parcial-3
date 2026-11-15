import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_ORIGIN,
  FALLBACK_EVENT_IMAGE,
  distanceKm,
  filterMapEvents,
  formatEventDate,
  formatEventTime,
  matchesDistance,
  matchesTime,
  toEventView,
  toServerQuery,
  walkingMinutes,
} from '../lib/eventMappers';
import type { ApiEvent, EventFilters } from '../types/models';

// 18:00 Bogota on Sat Nov 14 2026 (23:00 UTC), ending 02:00 the next day
const api: ApiEvent = {
  id: 'e1',
  title: 'Rooftop Sessions',
  description: 'd',
  venueName: 'Skyline',
  address: 'a',
  imageUrl: null,
  categories: ['rooftop'],
  status: 'open',
  startsAt: '2026-11-14T23:00:00.000Z',
  endsAt: '2026-11-15T07:00:00.000Z',
  latitude: 3.4516,
  longitude: -76.532,
  capacity: 400,
  occupied: 342,
  rating: 4.8,
  section: null,
  mapLabel: null,
  createdAt: '2026-11-01T00:00:00.000Z',
};
// Sat Nov 14 2026, 15:00 Bogota
const NOW = Date.parse('2026-11-14T20:00:00.000Z');
const view = (overrides: Partial<ApiEvent> = {}, now = NOW) =>
  toEventView({ ...api, ...overrides }, DEFAULT_ORIGIN, now);

test('formats date and time in Bogota', () => {
  assert.equal(formatEventDate(api.startsAt), 'Sat, Nov 14, 2026');
  assert.equal(formatEventTime(api.startsAt, api.endsAt), '6:00 pm - 2:00 am');
  assert.equal(formatEventTime(api.startsAt, null), '6:00 pm');
});

test('distance (haversine) and walking minutes', () => {
  assert.equal(distanceKm(DEFAULT_ORIGIN, DEFAULT_ORIGIN), 0);
  assert.equal(distanceKm(DEFAULT_ORIGIN, { latitude: 3.4448, longitude: -76.5412 }), 1.3);
  assert.equal(walkingMinutes(1.3), 16);
  assert.equal(walkingMinutes(0), 1);
});

test('toEventView fills fallbacks and derives the section', () => {
  const event = view();
  assert.equal(event.imageUrl, FALLBACK_EVENT_IMAGE);
  assert.equal(event.mapLabel, 'Rooftop Sessions');
  assert.equal(event.section, 'tonight');
  assert.equal(event.distanceKm, 0);
  assert.equal(view({ status: 'live' }).section, 'happening');
  assert.equal(view({ section: 'trending' }).section, 'trending');
  assert.equal(view({ startsAt: '2026-11-21T23:00:00.000Z', endsAt: null }).section, null);
});

test('time filter: an event matches by its start, or while it is in progress', () => {
  const tonight = view();
  assert.equal(matchesTime(tonight, 'all', NOW), true);
  assert.equal(matchesTime(tonight, 'today', NOW), true);
  assert.equal(matchesTime(tonight, 'tonight', NOW), true);
  // Ends at 02:00 Sunday but starts today: not a "tomorrow" event
  assert.equal(matchesTime(tonight, 'tomorrow', NOW), false);
  assert.equal(matchesTime(view({ startsAt: '2026-11-15T23:00:00.000Z', endsAt: null }), 'tomorrow', NOW), true);
  // Started yesterday, still going at 15:00 today: today, not tonight
  const ongoing = view({ startsAt: '2026-11-13T23:00:00.000Z', endsAt: '2026-11-14T21:00:00.000Z' });
  assert.equal(matchesTime(ongoing, 'today', NOW), true);
  assert.equal(matchesTime(ongoing, 'tonight', NOW), false);
  assert.equal(matchesTime(tonight, 'weekend', NOW), true);

  const nextWeek = view({ startsAt: '2026-11-18T23:00:00.000Z', endsAt: '2026-11-19T03:00:00.000Z' });
  for (const time of ['today', 'tonight', 'tomorrow', 'weekend']) {
    assert.equal(matchesTime(nextWeek, time, NOW), false, time);
  }
});

test('weekend window on a Wednesday is the coming Fri 18:00 to Mon 00:00', () => {
  const WED = Date.parse('2026-11-18T17:00:00.000Z');
  assert.equal(matchesTime(view({ startsAt: '2026-11-21T00:00:00.000Z', endsAt: null }, WED), 'weekend', WED), true);
  assert.equal(matchesTime(view({ startsAt: '2026-11-20T17:00:00.000Z', endsAt: null }, WED), 'weekend', WED), false);
});

test('distance filter: 10 km means any distance', () => {
  const far = { ...view(), distanceKm: 8 };
  assert.equal(matchesDistance(far, 5), false);
  assert.equal(matchesDistance(far, 10), true);
});

test('server query keeps only what GET /api/events understands', () => {
  const base: EventFilters = { search: '', category: 'all', status: 'all', time: 'all', maxDistance: 5 };
  assert.deepEqual(toServerQuery(base), {});
  assert.deepEqual(toServerQuery({ ...base, search: ' jazz ', category: 'bar', status: 'live' }), {
    search: 'jazz',
    category: 'bar',
    status: 'live',
  });
  assert.equal(toServerQuery({ ...base, category: 'popup' }), null);
});

test('map filter matches title, venue or label, and the LIVE/OPEN chip', () => {
  const events = [view({ id: 'a', status: 'live' }), view({ id: 'b', title: 'Jazz', venueName: 'La Cebra' })];
  assert.deepEqual(filterMapEvents(events, '', 'all').map((e) => e.id), ['a', 'b']);
  assert.deepEqual(filterMapEvents(events, 'cebra', 'all').map((e) => e.id), ['b']);
  assert.deepEqual(filterMapEvents(events, '', 'live').map((e) => e.id), ['a']);
});
