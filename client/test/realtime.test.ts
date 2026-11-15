import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import { createRequire } from 'node:module';
import path from 'node:path';

// lib/realtime gets its Supabase client from lib/supabase: a fake one is put in the module cache
// before lib/realtime is loaded, so no socket is ever opened
type Handler = (message: { payload: unknown }) => void;
const handlers = new Map<string, Handler>();
let onStatus: ((status: string, err?: Error) => void) | null = null;
const calls = { channel: 0, subscribe: 0, remove: 0 };

const fakeChannel = {
  on: (_type: string, filter: { event: string }, callback: Handler) => {
    handlers.set(filter.event, callback);
    return fakeChannel;
  },
  subscribe: (callback: (status: string, err?: Error) => void) => {
    calls.subscribe += 1;
    onStatus = callback;
    return fakeChannel;
  },
};
const fakeClient = {
  channel: (topic: string) => {
    assert.equal(topic, 'events');
    calls.channel += 1;
    return fakeChannel;
  },
  removeChannel: async () => {
    calls.remove += 1;
    return 'ok';
  },
};

const load = createRequire(path.join(__dirname, '../lib/realtime.ts'));
const supabasePath = load.resolve('./supabase');
load.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: { getRealtimeClient: () => fakeClient },
} as NodeJS.Module;
const realtime = load('./realtime') as typeof import('../lib/realtime');

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const ID = 'e0000000-0000-4000-8000-000000000003';
const noop = () => {};

beforeEach(() => {
  calls.channel = 0;
  calls.subscribe = 0;
  calls.remove = 0;
  // Reconnect logs are expected in these tests
  mock.method(console, 'warn', noop);
  mock.method(console, 'info', noop);
});

test('toEventSignal keeps only a valid uuid', () => {
  assert.deepEqual(realtime.toEventSignal({ id: ID, title: '<script>' }), { id: ID });
  assert.equal(realtime.toEventSignal({ id: 'evt-1' }), null);
  assert.equal(realtime.toEventSignal(null), null);
  assert.equal(realtime.toEventSignal('x'), null);
});

test('two subscribers share one channel and both get created and updated signals', async () => {
  const seen: string[] = [];
  const a = realtime.subscribeToEventsChannel({ onEventChanged: (s) => seen.push(`a:${s.id}`), onResync: noop });
  const b = realtime.subscribeToEventsChannel({ onEventChanged: (s) => seen.push(`b:${s.id}`), onResync: noop });
  assert.equal(calls.channel, 1);
  assert.equal(calls.subscribe, 1);
  assert.deepEqual(realtime.getEventsChannelState(), { listeners: 2, open: true });

  handlers.get('event-created')?.({ payload: { id: ID } });
  handlers.get('event-updated')?.({ payload: { id: ID } });
  handlers.get('event-updated')?.({ payload: { id: 'not-a-uuid' } });
  assert.deepEqual(seen, [`a:${ID}`, `b:${ID}`, `a:${ID}`, `b:${ID}`]);

  a();
  await tick();
  assert.equal(calls.remove, 0, 'one listener is still subscribed');
  b();
  await tick();
  assert.equal(calls.remove, 1);
  assert.deepEqual(realtime.getEventsChannelState(), { listeners: 0, open: false });
});

test('an immediate re-subscribe (Strict Mode) reuses the open channel', async () => {
  const unsubscribe = realtime.subscribeToEventsChannel({ onEventChanged: noop, onResync: noop });
  unsubscribe();
  const again = realtime.subscribeToEventsChannel({ onEventChanged: noop, onResync: noop });
  await tick();
  assert.equal(calls.channel, 1);
  assert.equal(calls.remove, 0);
  again();
  await tick();
  assert.equal(calls.remove, 1);
});

test('reconnecting after a failure resyncs once; the first SUBSCRIBED does not', async () => {
  let resyncs = 0;
  const unsubscribe = realtime.subscribeToEventsChannel({
    onEventChanged: noop,
    onResync: () => {
      resyncs += 1;
    },
  });
  onStatus?.('SUBSCRIBED');
  assert.equal(resyncs, 0);
  onStatus?.('CHANNEL_ERROR', new Error('transport failure'));
  onStatus?.('CHANNEL_ERROR', new Error('transport failure'));
  onStatus?.('SUBSCRIBED');
  assert.equal(resyncs, 1);
  unsubscribe();
  await tick();
});
