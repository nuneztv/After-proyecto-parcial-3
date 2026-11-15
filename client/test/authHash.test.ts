import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAuthHash } from '../lib/authHash';
import { validateEmail, validateNewPassword } from '../lib/validation';

test('parseAuthHash reads the session Supabase puts in the URL fragment', () => {
  assert.deepEqual(
    parseAuthHash('#access_token=a1&refresh_token=r1&expires_at=1900000000&type=recovery'),
    { kind: 'session', accessToken: 'a1', refreshToken: 'r1', expiresAt: 1900000000, type: 'recovery' },
  );
});

test('parseAuthHash derives expiresAt from expires_in when expires_at is missing', () => {
  const before = Math.floor(Date.now() / 1000);
  const result = parseAuthHash('access_token=a1&refresh_token=r1&expires_in=3600');

  assert.equal(result.kind, 'session');
  if (result.kind === 'session') {
    assert.ok(result.expiresAt >= before + 3600 && result.expiresAt <= before + 3601);
    assert.equal(result.type, null);
  }
});

test('parseAuthHash maps a cancelled sign-in and an expired link to fixed messages', () => {
  assert.deepEqual(parseAuthHash('#error=access_denied&error_description=User+cancelled'), {
    kind: 'error',
    message: 'Sign-in was cancelled',
  });
  assert.deepEqual(parseAuthHash('#error=access_denied&error_code=otp_expired'), {
    kind: 'error',
    message: 'This link is invalid or has expired. Please request a new one.',
  });
});

test('parseAuthHash never shows text taken from the URL', () => {
  const result = parseAuthHash('#error=server_error&error_description=Call+this+number+to+recover');

  assert.deepEqual(result, { kind: 'error', message: 'Sign-in failed, please try again' });
});

test('parseAuthHash is empty without tokens', () => {
  assert.deepEqual(parseAuthHash(''), { kind: 'empty' });
  assert.deepEqual(parseAuthHash('#access_token=a1'), { kind: 'empty' });
});

test('validateEmail and validateNewPassword', () => {
  assert.equal(validateEmail(''), 'Enter an email address');
  assert.equal(validateEmail('nope'), 'Enter a valid email address');
  assert.equal(validateEmail(' a@b.co '), null);

  assert.equal(validateNewPassword({ password: '', confirmPassword: '' }), 'Please fill in both fields');
  assert.equal(
    validateNewPassword({ password: 'short', confirmPassword: 'short' }),
    'Password must be at least 8 characters',
  );
  assert.equal(
    validateNewPassword({ password: 'newSecret123', confirmPassword: 'other1234' }),
    'Passwords do not match',
  );
  assert.equal(validateNewPassword({ password: 'newSecret123', confirmPassword: 'newSecret123' }), null);
});
