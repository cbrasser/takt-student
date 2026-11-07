import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewNotice, reviewNotices } from '../src/lib/reviewNotice.ts';
import { lessonKey, type Lesson } from '../src/lib/lessons.ts';

// 08:15–09:00 Zurich time (UTC+1 in winter): the Umfrage opens at 08:50 and
// closes at 09:15.
const lesson: Lesson = {
  teacherId: 'anna',
  id: '2026-11-02_0815_inf',
  courseId: 'inf',
  startsAt: new Date('2026-11-02T08:15:00+01:00'),
  endsAt: new Date('2026-11-02T09:00:00+01:00'),
  reviewOpenedAt: null,
  title: 'INF',
  topic: 'XOR',
  goals: [],
  standing: [],
  homework: '',
  materials: [],
  review: ['Was hast du gut verstanden?', 'Was war unklar?'],
};
const key = lessonKey(lesson);

const opens = new Date('2026-11-02T08:50:00+01:00');
const at = (d: Date, deltaMs: number) => new Date(d.getTime() + deltaMs);
const notAnswered = new Map([[key, false]]);

test('when the polling first sees the Umfrage open, it asks the server whether she has answered', () => {
  assert.deepEqual(reviewNotices([lesson], new Map(), [], true, at(opens, -1)), { due: [], ask: [], seen: [] });
  // Not yet asked: nothing due, and not seen, so the next poll decides.
  assert.deepEqual(reviewNotices([lesson], new Map(), [], true, opens), { due: [], ask: [lesson], seen: [] });
});

test('it fires once she hasn\'t answered, once per lesson: the next polls remember it, also after a restart', () => {
  const first = reviewNotices([lesson], notAnswered, [], true, opens);
  assert.deepEqual(first, { due: [lesson], ask: [], seen: [key] });
  assert.deepEqual(reviewNotices([lesson], notAnswered, first.seen, true, at(opens, 60_000)).due, []);
  // After a restart nothing is known about answers, but the lesson was seen: nothing to ask.
  assert.deepEqual(reviewNotices([lesson], new Map(), first.seen, true, at(opens, 60_000)), { due: [], ask: [], seen: [key] });
});

test('it never fires once answered', () => {
  const answered = new Map([[key, true]]);
  assert.deepEqual(reviewNotices([lesson], answered, [], true, opens), { due: [], ask: [], seen: [key] });
});

test('it never fires for a lesson without an Umfrage', () => {
  const plain = { ...lesson, review: null };
  assert.deepEqual(reviewNotices([plain], new Map([[key, false]]), [], true, opens), { due: [], ask: [], seen: [] });
});

test('it never fires when switched off, nor when switched on again while that Umfrage is open', () => {
  const off = reviewNotices([lesson], new Map(), [], false, opens);
  assert.deepEqual(off, { due: [], ask: [], seen: [key] });
  assert.deepEqual(reviewNotices([lesson], notAnswered, off.seen, true, at(opens, 60_000)).due, []);
});

test('it fires when the teacher opens the Umfrage early', () => {
  const early = { ...lesson, reviewOpenedAt: new Date('2026-11-02T08:30:00+01:00') };
  assert.deepEqual(reviewNotices([early], notAnswered, [], true, new Date('2026-11-02T08:31:00+01:00')).due, [early]);
});

test('the notification names the course and when the Umfrage closes', () => {
  const course = { teacherId: 'anna', id: 'inf', name: '3a · Informatik', siteUrl: null, semesters: [] };
  assert.deepEqual(reviewNotice(lesson, course), { title: 'Umfrage ist offen', body: '3a · Informatik · offen bis 09:15' });
  assert.deepEqual(reviewNotice(lesson, undefined), { title: 'Umfrage ist offen', body: 'Offen bis 09:15' });
});
