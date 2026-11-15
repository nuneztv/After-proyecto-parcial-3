import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLoginPath,
  canUseClientApp,
  getNextFromSearch,
  getSafeNextPath,
} from '../lib/redirect';

test('only client accounts can use the user app', () => {
  assert.equal(canUseClientApp({ role: 'client' }), true);
  assert.equal(canUseClientApp({ role: 'admin' }), false);
  assert.equal(canUseClientApp(null), false);
  assert.equal(canUseClientApp(undefined), false);
});

test('getSafeNextPath keeps same-app paths with query and hash', () => {
  assert.equal(
    getSafeNextPath('/events/e0000000-0000-4000-8000-000000000003'),
    '/events/e0000000-0000-4000-8000-000000000003',
  );
  assert.equal(getSafeNextPath('/search?x=1#top'), '/search?x=1#top');
  assert.equal(getSafeNextPath('/profile'), '/profile');
});

test('getSafeNextPath falls back to /home when missing or not a path', () => {
  for (const raw of [null, undefined, '', 'home', 'events/1']) {
    assert.equal(getSafeNextPath(raw), '/home', String(raw));
  }
});

test('getSafeNextPath rejects open redirects', () => {
  for (const raw of [
    'https://evil.com',
    '//evil.com',
    '//evil.com/home',
    '/\\evil.com',
    '/\\/evil.com',
    'javascript:alert(1)',
    '/home\nx',
    `/${'a'.repeat(600)}`,
  ]) {
    const safe = getSafeNextPath(raw);
    assert.ok(safe.startsWith('/') && !safe.startsWith('//'), raw);
    assert.ok(!safe.includes('evil.com'), raw);
  }
  assert.equal(getSafeNextPath('https://evil.com'), '/home');
  assert.equal(getSafeNextPath('//evil.com'), '/home');
  assert.equal(getSafeNextPath('/\\evil.com'), '/home');
});

test('getSafeNextPath never sends back to auth pages or the admin app (no loops)', () => {
  for (const raw of ['/', '/login', '/login?next=/home', '/register', '/forgot-password', '/reset-password', '/admin', '/admin/overview', '/login/']) {
    assert.equal(getSafeNextPath(raw), '/home', raw);
  }
  // Only whole path segments are blocked
  assert.equal(getSafeNextPath('/administrator-guide'), '/administrator-guide');
  assert.equal(getSafeNextPath('/loginfo'), '/loginfo');
});

test('buildLoginPath encodes the destination and drops invalid ones', () => {
  assert.equal(buildLoginPath('/events/abc?x=1'), '/login?next=%2Fevents%2Fabc%3Fx%3D1');
  assert.equal(buildLoginPath('/home'), '/login?next=%2Fhome');
  assert.equal(buildLoginPath('/login?next=%2Fprofile'), '/login');
  assert.equal(buildLoginPath('/'), '/login');
});

test('getNextFromSearch round-trips buildLoginPath and rejects unsafe values', () => {
  const login = buildLoginPath('/events/abc?x=1');
  assert.equal(getNextFromSearch(login.slice(login.indexOf('?'))), '/events/abc?x=1');
  assert.equal(getNextFromSearch('?next=https%3A%2F%2Fevil.com'), '/home');
  assert.equal(getNextFromSearch('?next=%2F%2Fevil.com'), '/home');
  assert.equal(getNextFromSearch(''), '/home');
});
