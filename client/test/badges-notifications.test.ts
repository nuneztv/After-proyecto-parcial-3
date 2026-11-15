import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeBadges } from '../lib/badges';
import {
  MAX_NOTIFICATIONS,
  diffEventNotifications,
  mergeNotifications,
  snapshotEvents,
} from '../lib/notifications';
import type { AppNotification } from '../lib/notifications';
import type { EventView } from '../types/models';

const unlocked = (stats: Parameters<typeof computeBadges>[0]) =>
  computeBadges(stats)
    .filter((badge) => badge.unlocked)
    .map((badge) => badge.id);

test('no activity unlocks no badge', () => {
  assert.deepEqual(unlocked({ savedCount: 0, ticketCount: 0, visitedCount: 0 }), []);
});

test('badges unlock from saved events, tickets and visited events', () => {
  assert.deepEqual(unlocked({ savedCount: 1, ticketCount: 0, visitedCount: 0 }), ['first-save']);
  assert.deepEqual(unlocked({ savedCount: 5, ticketCount: 1, visitedCount: 0 }), [
    'first-save',
    'collector',
    'ticket-holder',
  ]);
  assert.deepEqual(unlocked({ savedCount: 0, ticketCount: 3, visitedCount: 3 }), [
    'ticket-holder',
    'night-owl',
    'regular',
  ]);
});

test('a locked badge shows its progress, capped at the goal', () => {
  const badges = computeBadges({ savedCount: 2, ticketCount: 0, visitedCount: 7 });
  const byId = new Map(badges.map((badge) => [badge.id, badge]));

  assert.equal(byId.get('collector')?.progress, '2/5');
  assert.equal(byId.get('collector')?.unlocked, false);
  assert.equal(byId.get('regular')?.progress, '3/3');
});

const event = (id: string, overrides: Partial<EventView> = {}): EventView => ({
  id,
  title: `Event ${id}`,
  venueName: 'Venue',
  address: '',
  imageUrl: '',
  categories: [],
  status: 'open',
  startsAt: '2026-11-14T23:00:00.000Z',
  endsAt: null,
  displayDate: '',
  displayTime: '',
  latitude: 0,
  longitude: 0,
  distanceKm: 0,
  capacity: 100,
  occupied: 10,
  rating: 0,
  description: '',
  section: null,
  mapLabel: '',
  ...overrides,
});

const NOW = 1_000;

test('a new event is notified once', () => {
  const before = snapshotEvents([event('a')]);
  const after = [event('a'), event('b', { title: 'Jazz', venueName: 'La Cebra' })];

  assert.deepEqual(diffEventNotifications(before, after, new Set(), NOW), [
    { id: 'b:created', eventId: 'b', message: 'New event: Jazz at La Cebra', createdAt: NOW, read: false },
  ]);
  assert.deepEqual(diffEventNotifications(snapshotEvents(after), after, new Set(), NOW), []);
});

test('a status change is notified only for saved events', () => {
  const before = snapshotEvents([event('a'), event('b')]);
  const after = [event('a', { status: 'live' }), event('b', { status: 'live' })];

  const notifications = diffEventNotifications(before, after, new Set(['a']), NOW);
  assert.deepEqual(notifications.map((item) => item.message), ['Event a is now LIVE']);
});

test('occupancy changes alone are not notified', () => {
  const before = snapshotEvents([event('a')]);

  assert.deepEqual(diffEventNotifications(before, [event('a', { occupied: 99 })], new Set(['a']), NOW), []);
});

test('mergeNotifications puts new ones first, skips repeated ids and keeps the latest 20', () => {
  const make = (id: string): AppNotification => ({ id, eventId: id, message: id, createdAt: NOW, read: false });
  const current = [make('x')];

  assert.deepEqual(
    mergeNotifications(current, [make('y'), make('x')]).map((item) => item.id),
    ['y', 'x'],
  );

  const many = Array.from({ length: 30 }, (_, index) => make(`n${index}`));
  const merged = mergeNotifications([], many);
  assert.equal(merged.length, MAX_NOTIFICATIONS);
  assert.equal(merged[0].id, 'n29');
});
