// Fixed replacement for src/config so tests never depend on (or reach) the real Supabase project
// that dotenv would otherwise load. Use it as: mock.module('../../src/config', { namedExports: testConfig })

export const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
export const TEST_IMAGES_BUCKET = 'event-images';
export const TEST_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const testConfig = {
  PORT: 4000,
  NODE_ENV: 'test',
  CLIENT_ORIGIN: '*',
  DB_HOST: '',
  DB_PORT: 6543,
  DB_NAME: 'postgres',
  DB_USER: '',
  DB_PASSWORD: '',
  SUPABASE_URL: TEST_SUPABASE_URL,
  SUPABASE_SECRET_KEY: 'test-secret-key',
  IMAGES_BUCKET: TEST_IMAGES_BUCKET,
  MAX_IMAGE_BYTES: TEST_MAX_IMAGE_BYTES,
  ADMIN_SIGNUP_ENABLED: true,
  isDatabaseConfigured: (): boolean => false,
  isSupabaseConfigured: (): boolean => true,
};

export const IMAGE_UUID = 'f0000000-0000-4000-8000-000000000001';

// Public URL of an image stored in a user's folder, as POST /api/uploads/images returns it
export const ownImageUrl = (userId: string, file = `${IMAGE_UUID}.png`): string =>
  `${TEST_SUPABASE_URL}/storage/v1/object/public/${TEST_IMAGES_BUCKET}/${userId}/${file}`;
