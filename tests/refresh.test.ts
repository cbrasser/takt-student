import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFRESH_MS, refreshDue } from '../src/lib/refresh.ts';

const loadedAt = new Date('2026-11-02T08:20:00+01:00');
const at = (deltaMs: number) => new Date(loadedAt.getTime() + deltaMs);

test('it reads at once when nothing has been read', () => {
  assert.equal(refreshDue(null, loadedAt), true);
});

test('then every 15 minutes, also while a lesson is on', () => {
  assert.equal(refreshDue(loadedAt, at(60_000)), false);
  assert.equal(refreshDue(loadedAt, at(REFRESH_MS - 1)), false);
  assert.equal(refreshDue(loadedAt, at(REFRESH_MS)), true);
});
