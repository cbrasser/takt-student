import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatDay, formatTimes, formatWhen, isoDay } from '../src/lib/format.ts';

// 07:15 UTC is 08:15 in Zurich in winter, whatever the laptop's own zone.
const start = new Date('2026-11-02T07:15:00Z');
const end = new Date('2026-11-02T08:00:00Z');

test('times are shown on the Swiss clock', () => {
  assert.equal(formatTimes(start, end), '08:15–09:00');
});

test('the day is named in German', () => {
  assert.equal(formatDay(start), 'Montag, 2. November');
});

test('day and time go together', () => {
  assert.equal(formatWhen(start, end), 'Montag, 2. November · 08:15–09:00');
});

test('a day just after midnight in Zurich is still that day', () => {
  assert.equal(formatDay(new Date('2026-11-02T23:30:00Z')), 'Dienstag, 3. November');
});

test('a date to read again later carries its year', () => {
  assert.equal(formatDate(start), 'Montag, 2. November 2026');
});

test('the ISO day is Zurich\'s, as the database\'s dates are', () => {
  assert.equal(isoDay(start), '2026-11-02');
  assert.equal(isoDay(new Date('2026-11-02T23:30:00Z')), '2026-11-03');
});
