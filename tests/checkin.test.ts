import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkInLabel, checkInState, refreshDue, refusal, type CheckIn } from '../src/lib/checkin.ts';
import type { Lesson } from '../src/lib/lessons.ts';

const MIN = 60_000;

// 08:15–09:00 Zurich time (UTC+1 in winter).
const lesson: Lesson = {
  teacherId: 'anna',
  id: '2026-11-02_0815_inf',
  courseId: 'inf',
  startsAt: new Date('2026-11-02T08:15:00+01:00'),
  endsAt: new Date('2026-11-02T09:00:00+01:00'),
  title: 'INF',
  topic: '',
  goals: [],
  standing: [],
  homework: '',
  materials: [],
};
const nextWeek: Lesson = {
  ...lesson,
  id: '2026-11-09_0815_inf',
  startsAt: new Date('2026-11-09T08:15:00+01:00'),
  endsAt: new Date('2026-11-09T09:00:00+01:00'),
};

const at = (iso: string, deltaMs = 0) => new Date(new Date(iso).getTime() + deltaMs);

function checkIn(time: string | null, status: CheckIn['status']): CheckIn {
  return { teacherId: 'anna', lessonId: lesson.id, checkedInAt: time ? new Date(time) : null, status };
}

test('no "Bereit" a moment before the window opens', () => {
  assert.deepEqual(checkInState(lesson, undefined, at('2026-11-02T08:05:00+01:00', -1)), { kind: 'closed' });
});

test('"Bereit" from ten minutes before the start', () => {
  assert.deepEqual(checkInState(lesson, undefined, at('2026-11-02T08:05:00+01:00')), { kind: 'ready' });
});

test('"Bereit" until the last moment of the lesson', () => {
  assert.deepEqual(checkInState(lesson, undefined, at('2026-11-02T09:00:00+01:00', -1)), { kind: 'ready' });
});

test('no "Bereit" once the lesson has ended', () => {
  assert.deepEqual(checkInState(lesson, undefined, at('2026-11-02T09:00:00+01:00')), { kind: 'closed' });
});

test('checked in, inside the window and after it', () => {
  const done = checkIn('2026-11-02T08:17:00+01:00', 'on_time');
  assert.deepEqual(checkInState(lesson, done, at('2026-11-02T08:20:00+01:00')), { kind: 'checked-in', checkIn: done });
  assert.deepEqual(checkInState(lesson, done, at('2026-11-02T09:30:00+01:00')), { kind: 'checked-in', checkIn: done });
});

test('a row without a check-in (a cleared mark) still offers "Bereit"', () => {
  assert.deepEqual(checkInState(lesson, checkIn(null, 'missing'), at('2026-11-02T08:20:00+01:00')), { kind: 'ready' });
});

test('the label says when and how it counts', () => {
  assert.equal(checkInLabel(checkIn('2026-11-02T08:17:00+01:00', 'on_time')), 'Eingecheckt 08:17 · pünktlich');
  assert.equal(checkInLabel(checkIn('2026-11-02T08:21:00+01:00', 'late')), 'Eingecheckt 08:21 · zu spät');
});

test('the teacher\'s marks show as they are', () => {
  assert.equal(checkInLabel(checkIn('2026-11-02T08:21:00+01:00', 'excused')), 'Entschuldigt');
  assert.equal(checkInLabel(checkIn(null, 'present')), 'Als anwesend eingetragen');
});

test('a refusal says why', () => {
  assert.equal(refusal('check_in_not_open', lesson), 'Check-in ist erst ab 08:05 möglich.');
  assert.equal(refusal('check_in_closed', lesson), 'Die Lektion ist schon vorbei.');
  assert.equal(refusal('check_in_not_enrolled', lesson), 'Du bist nicht in diesem Kurs eingeschrieben.');
  assert.equal(refusal(undefined, lesson), 'Einchecken hat nicht geklappt. Bist du online?');
});

test('every minute while a check-in window is open', () => {
  const loaded = at('2026-11-02T08:10:00+01:00');
  assert.equal(refreshDue([lesson, nextWeek], loaded, at('2026-11-02T08:11:00+01:00')), true);
});

test('every 15 minutes otherwise', () => {
  const loaded = at('2026-11-02T10:00:00+01:00');
  assert.equal(refreshDue([lesson, nextWeek], loaded, at('2026-11-02T10:14:00+01:00')), false);
  assert.equal(refreshDue([lesson, nextWeek], loaded, at('2026-11-02T10:15:00+01:00')), true);
});

test('a window opening counts as open, by the device\'s clock', () => {
  const loaded = at('2026-11-02T08:00:00+01:00');
  assert.equal(refreshDue([lesson], loaded, at('2026-11-02T08:05:00+01:00')), true);
  assert.equal(refreshDue([lesson], loaded, at('2026-11-02T08:05:00+01:00', -1)), false);
});

test('nothing loaded yet: due', () => {
  assert.equal(refreshDue([], null, at('2026-11-02T10:00:00+01:00')), true);
});
