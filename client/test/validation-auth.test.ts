import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { validateLogin, validateRegister } from '../lib/validation';
import {
  SESSION_CLEARED_EVENT,
  expireStoredSession,
  getStoredSession,
  setStoredSession,
  updateStoredTokens,
} from '../lib/storage';
import { api, isRefreshableRequest } from '../lib/axios';
import type { StoredSession } from '../types/models';

// lib/storage reads window.localStorage at call time: a Map-backed stand-in for Node
const store = new Map<string, string>();
const fired: string[] = [];
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    dispatchEvent: (event: Event) => {
      fired.push(event.type);
      return true;
    },
  },
});

const session: StoredSession = {
  accessToken: 'old',
  refreshToken: 'r1',
  expiresAt: 1,
  user: {
    id: 'u1',
    fullName: 'Test',
    username: 'test',
    email: 't@a.co',
    avatarUrl: null,
    role: 'client',
    createdAt: '',
  },
};

beforeEach(() => {
  store.clear();
  fired.length = 0;
});

test('validateLogin requires both fields and a valid email', () => {
  assert.equal(validateLogin({ email: '', password: '' }), 'Please enter your email and password');
  assert.equal(validateLogin({ email: 'bad', password: 'x' }), 'Enter a valid email address');
  assert.equal(validateLogin({ email: ' a@b.co ', password: 'x' }), null);
});

test('validateRegister checks fields, name length, email, password length and confirmation', () => {
  const ok = { fullName: 'Ana', email: 'a@b.co', password: '12345678', confirmPassword: '12345678' };
  assert.equal(validateRegister(ok), null);
  assert.equal(validateRegister({ ...ok, fullName: ' ' }), 'Please fill in all fields');
  assert.equal(
    validateRegister({ ...ok, fullName: 'x'.repeat(81) }),
    'Full name must be at most 80 characters',
  );
  assert.equal(validateRegister({ ...ok, email: 'a@b' }), 'Enter a valid email address');
  assert.equal(
    validateRegister({ ...ok, password: '1234567', confirmPassword: '1234567' }),
    'Password must be at least 8 characters',
  );
  assert.equal(validateRegister({ ...ok, confirmPassword: 'other123' }), 'Passwords do not match');
});

test('storage discards the old mock session and corrupted values, and fires the cleared event', () => {
  store.set('after-session', JSON.stringify({ id: 'cli-1', fullName: 'Laura' }));
  assert.equal(getStoredSession(), null);
  assert.equal(store.has('after-session'), false);
  store.set('after-session', '{bad');
  assert.equal(getStoredSession(), null);

  setStoredSession(session);
  assert.deepEqual(getStoredSession(), session);
  updateStoredTokens({ accessToken: 'new', refreshToken: 'r2', expiresAt: 2 });
  assert.equal(getStoredSession()?.accessToken, 'new');
  expireStoredSession();
  assert.equal(getStoredSession(), null);
  assert.deepEqual(fired, [SESSION_CLEARED_EVENT]);
});

test('isRefreshableRequest excludes login, register and logout but not /me', () => {
  assert.equal(isRefreshableRequest('/api/events'), true);
  assert.equal(isRefreshableRequest('/api/auth/me'), true);
  assert.equal(isRefreshableRequest('/api/auth/login'), false);
  assert.equal(isRefreshableRequest('/api/auth/register'), false);
  assert.equal(isRefreshableRequest('/api/auth/logout'), false);
});

// Fake transport: answers with the given status, as axios' own adapters do
const reply = (config: InternalAxiosRequestConfig, status: number, data: unknown) => {
  const response = { data, status, statusText: '', headers: {}, config };
  if (status >= 400) {
    return Promise.reject(new AxiosError('Request failed', 'ERR', config, {}, response));
  }
  return Promise.resolve(response);
};

const authHeader = (config: InternalAxiosRequestConfig): string =>
  String(AxiosHeaders.from(config.headers).get('Authorization'));

test('a 401 triggers one shared refresh and both requests are retried with the new token', async () => {
  setStoredSession(session);
  let refreshCalls = 0;
  const seen: string[] = [];
  api.defaults.adapter = (config) => {
    seen.push(`${config.url} ${authHeader(config)}`);
    return authHeader(config) === 'Bearer fresh'
      ? reply(config, 200, { ok: config.url })
      : reply(config, 401, { message: 'expired' });
  };
  axios.defaults.adapter = (config) => {
    refreshCalls += 1;
    assert.equal(JSON.parse(String(config.data)).refreshToken, 'r1');
    return reply(config, 200, { accessToken: 'fresh', refreshToken: 'r2', expiresAt: 9 });
  };

  const [a, b] = await Promise.all([api.get('/api/events'), api.get('/api/auth/me')]);

  assert.deepEqual([a.data.ok, b.data.ok], ['/api/events', '/api/auth/me']);
  assert.equal(refreshCalls, 1);
  assert.equal(getStoredSession()?.refreshToken, 'r2');
  assert.ok(seen.includes('/api/events Bearer old'));
});

test('a failed refresh clears the session, fires the event and keeps the API message', async () => {
  setStoredSession(session);
  api.defaults.adapter = (config) => reply(config, 401, { message: 'Invalid or expired token' });
  axios.defaults.adapter = (config) => reply(config, 401, { message: 'Session expired' });

  await assert.rejects(api.get('/api/auth/me'), (err: AxiosError) => {
    assert.equal(err.message, 'Invalid or expired token');
    assert.equal(err.response?.status, 401);
    return true;
  });
  assert.equal(getStoredSession(), null);
  assert.deepEqual(fired, [SESSION_CLEARED_EVENT]);
});

test('wrong credentials on login are not refreshed', async () => {
  let refreshCalls = 0;
  api.defaults.adapter = (config) =>
    reply(config, 401, { message: 'Email or password is not correct' });
  axios.defaults.adapter = (config) => {
    refreshCalls += 1;
    return reply(config, 200, {});
  };

  await assert.rejects(api.post('/api/auth/login', {}), /Email or password is not correct/);
  assert.equal(refreshCalls, 0);
  assert.deepEqual(fired, []);
});

test('a network error gets a readable message', async () => {
  api.defaults.adapter = (config) =>
    Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));

  await assert.rejects(api.get('/api/events'), /We could not reach the After API/);
});

test('an explicit Authorization header is not replaced by the stored token', async () => {
  setStoredSession(session);
  let sent = '';
  api.defaults.adapter = (config) => {
    sent = authHeader(config);
    return reply(config, 204, null);
  };

  await api.post('/api/auth/logout', null, { headers: { Authorization: 'Bearer admin-token' } });
  assert.equal(sent, 'Bearer admin-token');
  await api.get('/api/events');
  assert.equal(sent, 'Bearer old');
});
