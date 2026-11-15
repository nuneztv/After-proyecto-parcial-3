import assert from 'node:assert/strict';
import { before, mock, test } from 'node:test';
import { IMAGE_UUID, ownImageUrl, TEST_SUPABASE_URL, testConfig } from '../helpers/configMock';

// Fixed config so the expected URLs never depend on the real project; isUserImageUrl is pure,
// and the Supabase client is replaced anyway so nothing here can reach Storage
mock.module('../../src/config', { namedExports: testConfig });
mock.module('../../src/lib/supabase', {
  namedExports: {
    getSupabase: () => {
      throw new Error('Supabase must not be called in storage tests');
    },
    createAuthClient: mock.fn(),
  },
});

let storage: typeof import('../../src/lib/storage');

before(async () => {
  storage = await import('../../src/lib/storage');
});

const USER_ID = 'user-1';
const folder = `${TEST_SUPABASE_URL}/storage/v1/object/public/event-images/${USER_ID}/`;

for (const extension of ['png', 'jpg', 'webp']) {
  test(`isUserImageUrl accepts a .${extension} image in the user's folder`, () => {
    assert.equal(storage.isUserImageUrl(ownImageUrl(USER_ID, `${IMAGE_UUID}.${extension}`), USER_ID), true);
  });
}

const rejected: Array<[string, string, string]> = [
  ['another user\'s folder', ownImageUrl('user-2'), USER_ID],
  [
    'another bucket',
    `${TEST_SUPABASE_URL}/storage/v1/object/public/other-bucket/${USER_ID}/${IMAGE_UUID}.png`,
    USER_ID,
  ],
  ['another host', `https://evil.example.com/storage/v1/object/public/event-images/${USER_ID}/${IMAGE_UUID}.png`, USER_ID],
  ['a path traversal', `${folder}../user-2/${IMAGE_UUID}.png`, USER_ID],
  ['a query string', `${folder}${IMAGE_UUID}.png?download=1`, USER_ID],
  ['a nested path', `${folder}nested/${IMAGE_UUID}.png`, USER_ID],
  ['a wrong extension', `${folder}${IMAGE_UUID}.gif`, USER_ID],
  ['a name that is not a UUID', `${folder}photo.png`, USER_ID],
  ['an empty user id', `${TEST_SUPABASE_URL}/storage/v1/object/public/event-images//${IMAGE_UUID}.png`, ''],
  ['a user id that only prefixes the folder', ownImageUrl('user-10'), USER_ID],
];

for (const [label, url, userId] of rejected) {
  test(`isUserImageUrl rejects ${label}`, () => {
    assert.equal(storage.isUserImageUrl(url, userId), false);
  });
}

test('IMAGE_EXTENSIONS maps the allowed MIME types to file extensions', () => {
  assert.deepEqual(storage.IMAGE_EXTENSIONS, {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  });
});
