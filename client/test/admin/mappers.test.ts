import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatEventDate,
  formatEventTime,
  toActivity,
  toAdminStatus,
  toAfterEvent,
  toCreateEventInput,
  toEventDraft,
  toUpdateEventInput,
} from '@/lib/admin/mappers';
import type { ApiActivity } from '@/lib/admin/types';
import { afterEvent, apiEvent, EVENT_ID, IMAGE_URL, validDraft } from './fixtures';

const ACTIVITY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

test('toAdminStatus keeps live', () => {
  assert.equal(toAdminStatus('live'), 'live');
});

test('toAdminStatus keeps closed', () => {
  assert.equal(toAdminStatus('closed'), 'closed');
});

test('toAdminStatus groups open as upcoming', () => {
  assert.equal(toAdminStatus('open'), 'upcoming');
});

test('toAdminStatus groups almost-full as upcoming', () => {
  assert.equal(toAdminStatus('almost-full'), 'upcoming');
});

test('formatEventDate formats the day in Bogota, not in UTC', () => {
  assert.equal(formatEventDate('2026-11-21T03:00:00.000Z'), 'Fri, Nov 20, 2026');
});

test('formatEventDate returns an empty string for an invalid date', () => {
  assert.equal(formatEventDate('not a date'), '');
});

test('formatEventTime formats a lowercase 12-hour time with a plain space', () => {
  assert.equal(formatEventTime('2026-11-20T23:00:00.000Z'), '6:00 pm');
});

test('formatEventTime returns an empty string for null', () => {
  assert.equal(formatEventTime(null), '');
});

test('toAfterEvent maps an API event to the admin view model', () => {
  assert.deepEqual(toAfterEvent(apiEvent), afterEvent);
});

test('toAfterEvent uses the brand image when the event has no image', () => {
  const event = toAfterEvent({ ...apiEvent, imageUrl: null });

  assert.deepEqual([event.image, event.imageUrl], ['/images/brand/logo-after.png', null]);
});

test('toAfterEvent leaves endTime empty when the event has no end', () => {
  assert.equal(toAfterEvent({ ...apiEvent, endsAt: null }).endTime, '');
});

test('toAfterEvent maps the live status', () => {
  assert.equal(toAfterEvent({ ...apiEvent, status: 'live' }).status, 'live');
});

const apiActivity: ApiActivity = {
  id: ACTIVITY_ID,
  eventId: EVENT_ID,
  message: '1 person checked in',
  createdAt: '2026-11-21T03:30:00.000Z',
};

test('toActivity maps a row without a nested event and leaves event out', () => {
  assert.deepEqual(toActivity(apiActivity), {
    id: ACTIVITY_ID,
    eventId: EVENT_ID,
    time: '10:30 pm',
    message: '1 person checked in',
    createdAt: '2026-11-21T03:30:00.000Z',
  });
});

test('toActivity maps the nested event with its name and admin status', () => {
  const activity = toActivity({
    ...apiActivity,
    event: { id: EVENT_ID, title: 'Rooftop Sessions', status: 'open' },
  });

  assert.deepEqual(activity.event, { id: EVENT_ID, name: 'Rooftop Sessions', status: 'upcoming' });
});

test('toActivity keeps a live nested event live', () => {
  const activity = toActivity({
    ...apiActivity,
    event: { id: EVENT_ID, title: 'Rooftop Sessions', status: 'live' },
  });

  assert.equal(activity.event?.status, 'live');
});

test('toEventDraft builds the edit form values in Bogota time', () => {
  assert.deepEqual(toEventDraft(afterEvent), {
    title: 'Rooftop Sessions',
    description: 'House music on the roof',
    venueName: 'Skyline Bar',
    date: '2026-11-20',
    time: '22:00',
    endDate: '2026-11-21',
    endTime: '03:00',
    capacity: '400',
    location: { latitude: 3.4495, longitude: -76.5385 },
    imageUrl: IMAGE_URL,
  });
});

test('toEventDraft leaves endDate and endTime empty when the event has no end', () => {
  const draft = toEventDraft({ ...afterEvent, endsAt: null });

  assert.deepEqual([draft.endDate, draft.endTime], ['', '']);
});

test('toEventDraft writes midnight as 00:00 (24-hour cycle)', () => {
  const draft = toEventDraft({ ...afterEvent, startsAt: '2026-11-21T05:00:00.000Z' });

  assert.deepEqual([draft.date, draft.time], ['2026-11-21', '00:00']);
});

test('toCreateEventInput builds the POST body with the Bogota offset', () => {
  assert.deepEqual(toCreateEventInput({ ...validDraft, imageUrl: IMAGE_URL }), {
    title: 'Rooftop Sessions',
    description: 'House music on the roof',
    venueName: 'Skyline Bar',
    startsAt: '2026-11-20T22:00:00-05:00',
    endsAt: null,
    latitude: 3.4495,
    longitude: -76.5385,
    capacity: 400,
    imageUrl: IMAGE_URL,
  });
});

test('toCreateEventInput trims the text fields and the capacity', () => {
  const input = toCreateEventInput({
    ...validDraft,
    title: '  Rooftop  ',
    description: ' Roof ',
    venueName: ' Skyline ',
    capacity: ' 250 ',
  });

  assert.deepEqual(
    [input.title, input.description, input.venueName, input.capacity],
    ['Rooftop', 'Roof', 'Skyline', 250],
  );
});

test('toCreateEventInput sends endsAt: null for an empty end time', () => {
  assert.equal(toCreateEventInput({ ...validDraft, endTime: '' }).endsAt, null);
});

test('toCreateEventInput sends endsAt: null for an empty end time even with an end date', () => {
  assert.equal(
    toCreateEventInput({ ...validDraft, endDate: '2026-11-22', endTime: '' }).endsAt,
    null,
  );
});

test('toCreateEventInput ends the same day when the end time is later and endDate is empty', () => {
  const input = toCreateEventInput({ ...validDraft, time: '18:00', endTime: '23:30' });

  assert.equal(input.endsAt, '2026-11-20T23:30:00-05:00');
});

test('toCreateEventInput ends the next day when the end time is earlier and endDate is empty', () => {
  assert.equal(
    toCreateEventInput({ ...validDraft, endTime: '03:00' }).endsAt,
    '2026-11-21T03:00:00-05:00',
  );
});

test('toCreateEventInput rolls the next day over the end of the month', () => {
  const input = toCreateEventInput({ ...validDraft, date: '2026-11-30', endTime: '02:00' });

  assert.equal(input.endsAt, '2026-12-01T02:00:00-05:00');
});

test('toCreateEventInput rolls the next day over the end of the year', () => {
  const input = toCreateEventInput({ ...validDraft, date: '2026-12-31', endTime: '04:00' });

  assert.equal(input.endsAt, '2027-01-01T04:00:00-05:00');
});

test('toCreateEventInput uses the explicit next-day end date when it is set', () => {
  const input = toCreateEventInput({ ...validDraft, endDate: '2026-11-21', endTime: '03:00' });

  assert.equal(input.endsAt, '2026-11-21T03:00:00-05:00');
});

test('toCreateEventInput keeps an end date two days later (event longer than 24 h)', () => {
  const input = toCreateEventInput({ ...validDraft, endDate: '2026-11-22', endTime: '23:00' });

  assert.equal(input.endsAt, '2026-11-22T23:00:00-05:00');
});

test('toCreateEventInput throws when the draft has no location', () => {
  assert.throws(
    () => toCreateEventInput({ ...validDraft, location: null }),
    /Select the location on the map/,
  );
});

test('toUpdateEventInput sends imageUrl: null when the image was removed', () => {
  assert.equal(toUpdateEventInput({ ...validDraft, imageUrl: null }).imageUrl, null);
});

test('toUpdateEventInput keeps the real end of an event longer than 24 h after a round trip', () => {
  // Fri Nov 20 10:00 pm to Sun Nov 22 6:00 am Bogota
  const longEvent = { ...afterEvent, endsAt: '2026-11-22T11:00:00.000Z' };

  const input = toUpdateEventInput(toEventDraft(longEvent));

  assert.deepEqual(
    [input.startsAt, input.endsAt],
    ['2026-11-20T22:00:00-05:00', '2026-11-22T06:00:00-05:00'],
  );
});

test('toUpdateEventInput round trip keeps the same instants as the stored event', () => {
  const input = toUpdateEventInput(toEventDraft(afterEvent));

  assert.deepEqual(
    [Date.parse(input.startsAt), Date.parse(input.endsAt ?? '')],
    [Date.parse('2026-11-21T03:00:00.000Z'), Date.parse('2026-11-21T08:00:00.000Z')],
  );
});

test('toUpdateEventInput round trip of an event without an end sends endsAt: null', () => {
  const input = toUpdateEventInput(toEventDraft({ ...afterEvent, endsAt: null }));

  assert.equal(input.endsAt, null);
});

test('toUpdateEventInput does not send the address (not editable from the form)', () => {
  const input = toUpdateEventInput(toEventDraft(afterEvent));

  assert.equal('address' in input, false);
});
