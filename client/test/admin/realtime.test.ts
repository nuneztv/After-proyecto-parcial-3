import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS_CHANNEL, REALTIME_EVENTS, toActivitySignal, toEventSignal } from '@/lib/admin/realtime';

// Broadcast payloads are untrusted (public channel): only valid UUID ids pass, nothing else is kept

const EVENT_ID = 'e0000000-0000-4000-8000-000000000004';
const ACTIVITY_ID = 'a0000000-0000-4000-8000-000000000009';

test('the admin listens on the same channel and event names the server emits', () => {
  assert.deepEqual(
    { channel: EVENTS_CHANNEL, events: REALTIME_EVENTS },
    {
      channel: 'events',
      events: {
        eventCreated: 'event-created',
        eventUpdated: 'event-updated',
        activityCreated: 'activity-created',
      },
    },
  );
});

test('toEventSignal keeps only the id of a valid signal', () => {
  assert.deepEqual(toEventSignal({ id: EVENT_ID }), { id: EVENT_ID });
});

test('toEventSignal drops forged data sent next to the id', () => {
  assert.deepEqual(
    toEventSignal({ id: EVENT_ID, title: 'FORGED', occupied: 999 }),
    { id: EVENT_ID },
  );
});

for (const payload of [{ id: 'evt-4' }, { id: 42 }, { title: 'no id' }, null, undefined, 'x']) {
  test(`toEventSignal rejects ${JSON.stringify(payload) ?? 'undefined'}`, () => {
    assert.equal(toEventSignal(payload), null);
  });
}

test('toActivitySignal keeps the activity id and its event id', () => {
  assert.deepEqual(
    toActivitySignal({ id: ACTIVITY_ID, eventId: EVENT_ID, message: 'ignored' }),
    { id: ACTIVITY_ID, eventId: EVENT_ID },
  );
});

for (const payload of [
  { id: ACTIVITY_ID },
  { eventId: EVENT_ID },
  { id: ACTIVITY_ID, eventId: 'not-a-uuid' },
  null,
]) {
  test(`toActivitySignal rejects ${JSON.stringify(payload)}`, () => {
    assert.equal(toActivitySignal(payload), null);
  });
}
