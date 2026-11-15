import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import { testConfig } from '../helpers/configMock';

// lib/supabase is replaced by a fake client: broadcast is checked without any network call
type SendResult = { success: boolean; status?: number; error?: unknown };

let supabaseConfigured = true;
let sendResult: () => Promise<SendResult> = async () => ({ success: true });

const httpSend = mock.fn(
  async (_event: string, _payload: unknown): Promise<SendResult> => sendResult(),
);
const channel = mock.fn((_name: string) => ({ httpSend }));
const getSupabase = mock.fn(() => ({ channel }));

mock.module('../../src/config', {
  namedExports: { ...testConfig, isSupabaseConfigured: (): boolean => supabaseConfigured },
});
mock.module('../../src/lib/supabase', {
  namedExports: { getSupabase, createAuthClient: mock.fn() },
});

let realtime: typeof import('../../src/lib/realtime');
const consoleError = mock.method(console, 'error', (): void => undefined);

before(async () => {
  realtime = await import('../../src/lib/realtime');
});

after(() => {
  consoleError.mock.restore();
});

beforeEach(() => {
  supabaseConfigured = true;
  sendResult = async () => ({ success: true });
  [httpSend, channel, getSupabase, consoleError].forEach((fn) => fn.mock.resetCalls());
});

const payload = { id: 'e0000000-0000-4000-8000-000000000001', occupied: 343 };

test('broadcast opens the channel by name', async () => {
  await realtime.broadcast('events', 'event-updated', payload);

  assert.deepEqual(channel.mock.calls[0].arguments, ['events']);
});

test('broadcast sends the event and payload with httpSend', async () => {
  await realtime.broadcast('events', 'event-updated', payload);

  assert.deepEqual(httpSend.mock.calls[0].arguments, [
    'event-updated',
    { id: 'e0000000-0000-4000-8000-000000000001', occupied: 343 },
  ]);
});

test('broadcast does not log when httpSend succeeds', async () => {
  await realtime.broadcast('events', 'event-updated', payload);

  assert.equal(consoleError.mock.callCount(), 0);
});

test('broadcast resolves when httpSend rejects', async () => {
  sendResult = async () => {
    throw new Error('network down');
  };

  await assert.doesNotReject(() => realtime.broadcast('events', 'event-updated', payload));
});

test('broadcast logs the error when httpSend rejects', async () => {
  sendResult = async () => {
    throw new Error('network down');
  };

  await realtime.broadcast('events', 'event-updated', payload);

  assert.equal(consoleError.mock.callCount(), 1);
});

test('broadcast resolves when httpSend answers success false', async () => {
  sendResult = async () => ({ success: false, status: 500, error: 'boom' });

  await assert.doesNotReject(() => realtime.broadcast('events', 'event-updated', payload));
});

test('broadcast logs the error when httpSend answers success false', async () => {
  sendResult = async () => ({ success: false, status: 500, error: 'boom' });

  await realtime.broadcast('events', 'event-updated', payload);

  assert.equal(consoleError.mock.callCount(), 1);
});

test('broadcast does not touch Supabase when it is not configured', async () => {
  supabaseConfigured = false;

  await realtime.broadcast('events', 'event-updated', payload);

  assert.equal(getSupabase.mock.callCount(), 0);
});

test('broadcast exposes the event names the admin app listens to', () => {
  assert.deepEqual(realtime.REALTIME_EVENTS, {
    eventCreated: 'event-created',
    eventUpdated: 'event-updated',
    activityCreated: 'activity-created',
  });
});
