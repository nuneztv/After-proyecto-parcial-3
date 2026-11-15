import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCapacityPercent, getCapacityTag } from '@/lib/admin/capacity';

test('getCapacityPercent rounds the occupancy percentage', () => {
  assert.equal(getCapacityPercent(342, 400), 86);
});

test('getCapacityPercent rounds half up', () => {
  assert.equal(getCapacityPercent(1, 8), 13);
});

test('getCapacityPercent returns 0 for a zero capacity', () => {
  assert.equal(getCapacityPercent(10, 0), 0);
});

test('getCapacityPercent can exceed 100 when over capacity', () => {
  assert.equal(getCapacityPercent(450, 400), 113);
});

test('getCapacityTag is empty below 80 %', () => {
  assert.equal(getCapacityTag(79), '');
});

test('getCapacityTag is ALMOST FULL from 80 %', () => {
  assert.equal(getCapacityTag(80), 'ALMOST FULL');
});

test('getCapacityTag is ALMOST FULL at 99 %', () => {
  assert.equal(getCapacityTag(99), 'ALMOST FULL');
});

test('getCapacityTag is FULL at 100 %', () => {
  assert.equal(getCapacityTag(100), 'FULL');
});

test('getCapacityTag is FULL above 100 %', () => {
  assert.equal(getCapacityTag(113), 'FULL');
});
