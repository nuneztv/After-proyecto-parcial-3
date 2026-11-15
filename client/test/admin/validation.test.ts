import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEventDraft, validateLogin, validateRegister } from '@/lib/admin/validation';
import type { RegisterInput } from '@/lib/admin/types';
import { validDraft } from './fixtures';

const CAPACITY_MESSAGE = 'Capacity must be a whole number between 1 and 100000';

test('validateEventDraft returns no errors for a valid draft', () => {
  assert.deepEqual(validateEventDraft(validDraft), {});
});

test('validateEventDraft reports every missing required field', () => {
  const errors = validateEventDraft({
    ...validDraft,
    title: '  ',
    venueName: '',
    date: '',
    time: '',
    capacity: '',
    location: null,
  });

  assert.deepEqual(errors, {
    title: 'Enter the event name',
    venueName: 'Enter the venue',
    date: 'Select the date',
    time: 'Select the start time',
    capacity: CAPACITY_MESSAGE,
    location: 'Select the location on the map',
  });
});

test('validateEventDraft rejects an impossible start date (February 30)', () => {
  assert.equal(validateEventDraft({ ...validDraft, date: '2026-02-30' }).date, 'Select the date');
});

test('validateEventDraft rejects an impossible end date (February 30)', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, endDate: '2026-02-30', endTime: '23:00' }).endDate,
    'End date is invalid',
  );
});

test('validateEventDraft accepts February 29 of a leap year', () => {
  assert.equal(validateEventDraft({ ...validDraft, date: '2028-02-29' }).date, undefined);
});

test('validateEventDraft rejects a title longer than 80 characters', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, title: 'a'.repeat(81) }).title,
    'Event name must be at most 80 characters',
  );
});

test('validateEventDraft rejects a description longer than 500 characters', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, description: 'a'.repeat(501) }).description,
    'Description must be at most 500 characters',
  );
});

test('validateEventDraft rejects a venue longer than 80 characters', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, venueName: 'a'.repeat(81) }).venueName,
    'Venue must be at most 80 characters',
  );
});

for (const capacity of ['0', '100001', '1.5', '-3', 'abc']) {
  test(`validateEventDraft rejects the capacity "${capacity}"`, () => {
    assert.equal(validateEventDraft({ ...validDraft, capacity }).capacity, CAPACITY_MESSAGE);
  });
}

test('validateEventDraft accepts the capacity limits 1 and 100000', () => {
  assert.deepEqual(
    [
      validateEventDraft({ ...validDraft, capacity: '1' }).capacity,
      validateEventDraft({ ...validDraft, capacity: '100000' }).capacity,
    ],
    [undefined, undefined],
  );
});

test('validateEventDraft rejects a capacity below the current occupancy', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, capacity: '300' }, { minCapacity: 342 }).capacity,
    'Capacity cannot be lower than the current occupancy (342 people)',
  );
});

test('validateEventDraft accepts a capacity equal to the current occupancy', () => {
  assert.deepEqual(validateEventDraft({ ...validDraft, capacity: '342' }, { minCapacity: 342 }), {});
});

test('validateEventDraft rejects an invalid end time', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, endTime: '25:00' }).endTime,
    'End time is invalid',
  );
});

test('validateEventDraft rejects an end time equal to the start without an end date', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, endTime: '22:00' }).endTime,
    'End time must be after the start time',
  );
});

test('validateEventDraft accepts an earlier end time without an end date (next day)', () => {
  assert.deepEqual(validateEventDraft({ ...validDraft, endTime: '03:00' }), {});
});

test('validateEventDraft rejects an invalid end date', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, endDate: '2026-13-45', endTime: '03:00' }).endDate,
    'End date is invalid',
  );
});

test('validateEventDraft requires the end time when the end date is set', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, endDate: '2026-11-21', endTime: '' }).endTime,
    'Select the end time',
  );
});

test('validateEventDraft rejects an end date before the start date', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, endDate: '2026-11-19', endTime: '23:00' }).endDate,
    'End date cannot be before the start date',
  );
});

test('validateEventDraft rejects an end on the start date at the start time', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, endDate: '2026-11-20', endTime: '22:00' }).endTime,
    'End must be after the start',
  );
});

test('validateEventDraft rejects an end on the start date before the start time', () => {
  assert.equal(
    validateEventDraft({ ...validDraft, endDate: '2026-11-20', endTime: '03:00' }).endTime,
    'End must be after the start',
  );
});

test('validateEventDraft accepts an end date days after the start', () => {
  assert.deepEqual(
    validateEventDraft({ ...validDraft, endDate: '2026-11-22', endTime: '06:00' }),
    {},
  );
});

test('validateLogin rejects an invalid email', () => {
  assert.equal(validateLogin('lina@after', 'secret123'), 'Enter a valid email address');
});

test('validateLogin requires the password', () => {
  assert.equal(validateLogin('lina@after.app', ''), 'Enter your password');
});

test('validateLogin accepts an email with surrounding spaces and a password', () => {
  assert.equal(validateLogin('  lina@after.app  ', 'secret123'), null);
});

const registerInput: RegisterInput = {
  fullName: 'Lina Sanchez',
  email: 'lina@after.app',
  password: 'secret123',
};

test('validateRegister accepts a complete input with a matching confirmation', () => {
  assert.equal(validateRegister(registerInput, 'secret123'), null);
});

test('validateRegister requires the full name', () => {
  assert.equal(
    validateRegister({ ...registerInput, fullName: '  ' }, 'secret123'),
    'Enter your full name',
  );
});

test('validateRegister rejects an invalid email', () => {
  assert.equal(
    validateRegister({ ...registerInput, email: 'lina' }, 'secret123'),
    'Enter a valid email address',
  );
});

test('validateRegister rejects a password shorter than 8 characters', () => {
  assert.equal(
    validateRegister({ ...registerInput, password: 'short' }, 'short'),
    'Password must be at least 8 characters',
  );
});

test('validateRegister rejects a confirmation that does not match', () => {
  assert.equal(validateRegister(registerInput, 'secret124'), 'Passwords do not match');
});
