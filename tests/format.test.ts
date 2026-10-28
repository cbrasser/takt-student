import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatDate, formatDay, formatIsoDay, formatTimes, formatWeek, formatWhen, hourOf, isoDay } from '../src/lib/format.ts';

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

test('a day given as "2026-11-09" is named as that day, wherever the laptop is', () => {
  assert.equal(formatIsoDay('2026-11-09'), 'Montag, 9. November');
  assert.equal(formatWeek('2026-11-09'), 'Woche vom 9. November');
});

test('the hour and the days around a day are Zurich\'s too', () => {
  assert.equal(hourOf(new Date('2026-11-02T06:30:00Z')), 7);
  assert.equal(addDays('2026-11-16', -7), '2026-11-09');
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
});
