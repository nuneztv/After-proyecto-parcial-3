import assert from 'node:assert/strict';
import { before, mock, test } from 'node:test';
import { asyncMock, statusOf } from '../helpers/supabaseMocks';

const signUp = asyncMock();

mock.module('../../src/lib/supabase', {
  namedExports: {
    createAuthClient: () => ({ auth: { signUp } }),
    getSupabase: () => ({ auth: { admin: { deleteUser: mock.fn() } } }),
  },
});
mock.module('../../src/config', { namedExports: { ADMIN_SIGNUP_ENABLED: false } });
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { createProfileService: mock.fn(), getProfileByIdService: mock.fn() },
});

let service: typeof import('../../src/features/auth/auth.service');

before(async () => {
  service = await import('../../src/features/auth/auth.service');
});

test('registerService throws 403 for admins when admin signup is closed', async () => {
  await assert.rejects(
    () => service.registerService({ email: 'a@after.app', password: 'secret123', fullName: 'A' }, 'admin'),
    (error) => statusOf(error) === 403,
  );
});

test('registerService does not call Supabase when admin signup is closed', async () => {
  await assert.rejects(() =>
    service.registerService({ email: 'a@after.app', password: 'secret123', fullName: 'A' }, 'admin'),
  );

  assert.equal(signUp.mock.callCount(), 0);
});
