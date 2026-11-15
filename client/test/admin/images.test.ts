import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IMAGE_ACCEPT,
  isRemoteImage,
  MAX_IMAGE_BYTES,
  validateImageFile,
} from '@/lib/admin/images';

// Node 20+ ships the File global; only type and size matter to the validator
const fileOf = (type: string, size: number): File => new File([new Uint8Array(size)], 'a', { type });

test('IMAGE_ACCEPT lists the allowed MIME types for the file input', () => {
  assert.equal(IMAGE_ACCEPT, 'image/jpeg,image/png,image/webp');
});

test('MAX_IMAGE_BYTES is 5 MB', () => {
  assert.equal(MAX_IMAGE_BYTES, 5242880);
});

for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
  test(`validateImageFile accepts ${type}`, () => {
    assert.equal(validateImageFile(fileOf(type, 10)), null);
  });
}

test('validateImageFile rejects a GIF', () => {
  assert.equal(
    validateImageFile(fileOf('image/gif', 10)),
    'Only JPEG, PNG or WebP images are allowed',
  );
});

test('validateImageFile accepts an image of exactly 5 MB', () => {
  assert.equal(validateImageFile(fileOf('image/png', 5242880)), null);
});

test('validateImageFile rejects an image over 5 MB', () => {
  assert.equal(validateImageFile(fileOf('image/png', 5242881)), 'Image must be at most 5 MB');
});

test('isRemoteImage is true for an https URL', () => {
  assert.equal(isRemoteImage('https://test-project.supabase.co/a.png'), true);
});

test('isRemoteImage is true for an uppercase HTTP URL', () => {
  assert.equal(isRemoteImage('HTTP://example.com/a.png'), true);
});

test('isRemoteImage is false for a local public path', () => {
  assert.equal(isRemoteImage('/images/brand/logo-after.png'), false);
});
