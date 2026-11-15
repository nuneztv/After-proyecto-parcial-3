import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getDraftFormPath,
  getDraftMapPath,
  getEditEventPath,
  isEventId,
  NEW_DRAFT_KEY,
  parseDraftKey,
  toEditDraftKey,
} from '@/lib/admin/drafts';
import { EVENT_ID } from './fixtures';

test('NEW_DRAFT_KEY is "new"', () => {
  assert.equal(NEW_DRAFT_KEY, 'new');
});

test('isEventId accepts a UUID', () => {
  assert.equal(isEventId(EVENT_ID), true);
});

test('isEventId rejects a legacy mock id', () => {
  assert.equal(isEventId('evt-1'), false);
});

test('toEditDraftKey prefixes the event id with edit:', () => {
  assert.equal(toEditDraftKey(EVENT_ID), `edit:${EVENT_ID}`);
});

test('parseDraftKey defaults to the create draft without a value', () => {
  assert.equal(parseDraftKey(null), 'new');
});

test('parseDraftKey returns the create draft for "new"', () => {
  assert.equal(parseDraftKey('new'), 'new');
});

test('parseDraftKey returns the edit key for edit:<uuid>', () => {
  assert.equal(parseDraftKey(`edit:${EVENT_ID}`), `edit:${EVENT_ID}`);
});

test('parseDraftKey falls back to the create draft for an edit key with a non-UUID id', () => {
  assert.equal(parseDraftKey('edit:evt-1'), 'new');
});

test('parseDraftKey falls back to the create draft for an edit key without an id', () => {
  assert.equal(parseDraftKey('edit:'), 'new');
});

test('parseDraftKey falls back to the create draft for an unknown value', () => {
  assert.equal(parseDraftKey(EVENT_ID), 'new');
});

test('getEditEventPath points to the edit page of the event', () => {
  assert.equal(getEditEventPath(EVENT_ID), `/admin/events/${EVENT_ID}/edit`);
});

test('getDraftFormPath sends the create draft back to the new event form', () => {
  assert.equal(getDraftFormPath('new'), '/admin/events/new');
});

test('getDraftFormPath sends an edit draft back to its edit form', () => {
  assert.equal(getDraftFormPath(`edit:${EVENT_ID}`), `/admin/events/${EVENT_ID}/edit`);
});

test('getDraftMapPath passes the create draft key to the map', () => {
  assert.equal(getDraftMapPath('new'), '/admin/map?draft=new');
});

test('getDraftMapPath URL-encodes the colon of an edit key', () => {
  assert.equal(getDraftMapPath(`edit:${EVENT_ID}`), `/admin/map?draft=edit%3A${EVENT_ID}`);
});

test('getDraftMapPath and parseDraftKey round trip an edit key', () => {
  const query = getDraftMapPath(`edit:${EVENT_ID}`).split('?')[1];

  assert.equal(parseDraftKey(new URLSearchParams(query).get('draft')), `edit:${EVENT_ID}`);
});
