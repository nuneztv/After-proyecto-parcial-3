import { mock } from 'node:test';

// Shapes returned by the mocked Supabase client in auth tests.
// Hand-written so the expected values in each test stay explicit.

// mock.fn() without an implementation is typed as () => undefined; this one accepts any async result
export const asyncMock = () => mock.fn(async (..._args: unknown[]): Promise<unknown> => undefined);

export const supabaseSession = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_at: 1900000000,
};

export const supabaseUser = (id = 'user-1', identities: unknown[] = [{ id: 'identity-1' }]) => ({
  id,
  email: 'lina@after.app',
  identities,
});

export const authError = (status: number, code: string, message = 'error') => ({
  status,
  code,
  message,
});

export const adminProfile = {
  id: 'user-1',
  fullName: 'Lina Sanchez',
  username: 'lina',
  email: 'lina@after.app',
  avatarUrl: null,
  role: 'admin' as const,
  createdAt: '2026-11-14T00:00:00.000Z',
};

export const clientProfile = { ...adminProfile, role: 'client' as const };

export const statusOf = (error: unknown): number | undefined =>
  (error as { output?: { statusCode?: number } }).output?.statusCode;
