import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDay, formatTimes } from '../src/lib/format.ts';

// 07:15 UTC is 08:15 in Zurich in winter, whatever the laptop's own zone.
const start = new Date('2026-11-02T07:15:00Z');
const end = new Date('2026-11-02T08:00:00Z');

test('times are shown on the Swiss clock', () => {
  assert.equal(formatTimes(start, end), '08:15–09:00');
});

test('the day is named in German', () => {
  assert.equal(formatDay(start), 'Montag, 2. November');
});

test('a day just after midnight in Zurich is still that day', () => {
  assert.equal(formatDay(new Date('2026-11-02T23:30:00Z')), 'Dienstag, 3. November');
});
