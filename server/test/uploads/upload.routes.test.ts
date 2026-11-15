import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import { Express } from 'express';
import request from 'supertest';
import { asyncMock } from '../helpers/supabaseMocks';
import { TEST_MAX_IMAGE_BYTES, TEST_SUPABASE_URL, testConfig } from '../helpers/configMock';

// The real upload service runs against a fake Supabase client: no Auth, Storage or Realtime call
// leaves the process. getBucket/createBucket are spies to prove importing the app does not
// run ensureImagesBucket (only start() does).

interface UploadResult {
  error: { message: string } | null;
}

const getUser = asyncMock();
const getProfileRoleService = asyncMock();
let uploadResult: () => Promise<UploadResult> = async () => ({ error: null });
const upload = mock.fn(
  async (_path: string, _body: Buffer, _options: unknown): Promise<UploadResult> => uploadResult(),
);
const getPublicUrl = mock.fn((path: string) => ({
  data: { publicUrl: `${TEST_SUPABASE_URL}/storage/v1/object/public/event-images/${path}` },
}));
const from = mock.fn((_bucket: string) => ({ upload, getPublicUrl }));
const getBucket = asyncMock();
const createBucket = asyncMock();
const broadcast = asyncMock();

mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: {
    getSupabase: () => ({ auth: { getUser }, storage: { from, getBucket, createBucket } }),
    createAuthClient: mock.fn(),
  },
});
mock.module('../../src/lib/realtime', {
  namedExports: {
    broadcast,
    EVENTS_CHANNEL: 'events',
    REALTIME_EVENTS: {
      eventCreated: 'event-created',
      eventUpdated: 'event-updated',
      activityCreated: 'activity-created',
    },
  },
});
mock.module('../../src/features/profiles/profile.service', {
  namedExports: { getProfileRoleService },
});

let app: Express;
// errorsMiddleware logs 5xx causes; keep the test output clean
const consoleError = mock.method(console, 'error', (): void => undefined);

before(async () => {
  const mod = await import('../../src/app');
  // CommonJS interop: the default export can arrive wrapped once more
  app = ((mod.default as unknown as { default?: Express }).default ?? mod.default) as Express;

  getUser.mock.mockImplementation(async () => ({
    data: { user: { id: 'user-1', email: 'lina@after.app' } },
    error: null,
  }));
});

after(() => {
  consoleError.mock.restore();
});

beforeEach(() => {
  uploadResult = async () => ({ error: null });
  [upload, getPublicUrl, from].forEach((fn) => fn.mock.resetCalls());
});

const asRole = (role: 'admin' | 'client'): void => {
  getProfileRoleService.mock.mockImplementation(async () => role);
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const STORED_PATH =
  /^user-1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

const postImage = (file: Buffer = PNG, contentType = 'image/png', filename = 'flyer.png') =>
  request(app)
    .post('/api/uploads/images')
    .set('Authorization', 'Bearer valid')
    .attach('image', file, { filename, contentType });

const storedPath = (): string => upload.mock.calls[0].arguments[0];

test('importing the app does not check or create the images bucket', () => {
  assert.equal(getBucket.mock.callCount() + createBucket.mock.callCount(), 0);
});

test('POST /api/uploads/images answers 401 without a token', async () => {
  const res = await request(app)
    .post('/api/uploads/images')
    .attach('image', PNG, { filename: 'flyer.png', contentType: 'image/png' });

  assert.equal(res.status, 401);
});

test('POST /api/uploads/images answers 403 for a client token', async () => {
  asRole('client');

  const res = await postImage();

  assert.equal(res.status, 403);
});

test('POST /api/uploads/images does not upload for a client token', async () => {
  asRole('client');

  await postImage();

  assert.equal(upload.mock.callCount(), 0);
});

test('POST /api/uploads/images answers 400 "Image is required" without a file', async () => {
  asRole('admin');

  const res = await request(app)
    .post('/api/uploads/images')
    .set('Authorization', 'Bearer valid')
    .field('title', 'no image');

  assert.deepEqual([res.status, res.body.message], [400, 'Image is required']);
});

test('POST /api/uploads/images answers 415 for a GIF', async () => {
  asRole('admin');

  const res = await postImage(Buffer.from('GIF89a'), 'image/gif', 'flyer.gif');

  assert.deepEqual(
    [res.status, res.body.message],
    [415, 'Only JPEG, PNG or WebP images are allowed'],
  );
});

test('POST /api/uploads/images does not upload a rejected file type', async () => {
  asRole('admin');

  await postImage(Buffer.from('GIF89a'), 'image/gif', 'flyer.gif');

  assert.equal(upload.mock.callCount(), 0);
});

test('POST /api/uploads/images answers 413 for an image over 5 MB', async () => {
  asRole('admin');

  const res = await postImage(Buffer.alloc(TEST_MAX_IMAGE_BYTES + 1));

  assert.deepEqual([res.status, res.body.message], [413, 'Image must be at most 5 MB']);
});

test('POST /api/uploads/images answers 400 for two files', async () => {
  asRole('admin');

  const res = await request(app)
    .post('/api/uploads/images')
    .set('Authorization', 'Bearer valid')
    .attach('image', PNG, { filename: 'a.png', contentType: 'image/png' })
    .attach('image', PNG, { filename: 'b.png', contentType: 'image/png' });

  assert.equal(res.status, 400);
});

test('POST /api/uploads/images answers 502 "Image upload failed" when Storage fails', async () => {
  asRole('admin');
  uploadResult = async () => ({ error: { message: 'Bucket not found' } });

  const res = await postImage();

  assert.deepEqual([res.status, res.body.message], [502, 'Image upload failed']);
});

test('POST /api/uploads/images answers 201 with the public URL of the stored image', async () => {
  asRole('admin');

  const res = await postImage();

  assert.deepEqual(
    [res.status, res.body],
    [201, { url: `${TEST_SUPABASE_URL}/storage/v1/object/public/event-images/${storedPath()}` }],
  );
});

test('POST /api/uploads/images uploads to the images bucket', async () => {
  asRole('admin');

  await postImage();

  assert.deepEqual(from.mock.calls[0].arguments, ['event-images']);
});

test('POST /api/uploads/images stores the image as <userId>/<uuid>.png', async () => {
  asRole('admin');

  await postImage();

  assert.match(storedPath(), STORED_PATH);
});

test('POST /api/uploads/images stores a JPEG with the .jpg extension', async () => {
  asRole('admin');

  await postImage(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg', 'flyer.jpeg');

  assert.match(storedPath(), /\.jpg$/);
});

test('POST /api/uploads/images gives every upload a new file name', async () => {
  asRole('admin');

  await postImage();
  await postImage();

  assert.notEqual(upload.mock.calls[0].arguments[0], upload.mock.calls[1].arguments[0]);
});

test('POST /api/uploads/images sends the bytes with the content type and no upsert', async () => {
  asRole('admin');

  await postImage();

  assert.deepEqual(upload.mock.calls[0].arguments.slice(1), [
    PNG,
    { contentType: 'image/png', upsert: false },
  ]);
});
