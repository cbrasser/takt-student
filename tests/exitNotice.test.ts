import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exitNotice, exitNotices } from '../src/lib/exitNotice.ts';
import type { ExitTicket } from '../src/lib/exitTicket.ts';
import { lessonKey, type Lesson } from '../src/lib/lessons.ts';

// 08:15–09:00 Zurich time (UTC+1 in winter): the ticket opens at 08:50 and
// closes at 09:15.
const lesson: Lesson = {
  teacherId: 'anna',
  id: '2026-11-02_0815_inf',
  courseId: 'inf',
  startsAt: new Date('2026-11-02T08:15:00+01:00'),
  endsAt: new Date('2026-11-02T09:00:00+01:00'),
  exitOpenedAt: null,
  title: 'INF',
  topic: 'XOR',
  goals: [],
  standing: [],
  homework: '',
  materials: [],
  review: null,
};

const opens = new Date('2026-11-02T08:50:00+01:00');
const at = (d: Date, deltaMs: number) => new Date(d.getTime() + deltaMs);

test('it fires when the polling first sees the ticket open', () => {
  assert.deepEqual(exitNotices([lesson], [], [], true, at(opens, -1)).due, []);
  assert.deepEqual(exitNotices([lesson], [], [], true, opens).due, [lesson]);
});

test('it fires once per lesson: the next polls remember it, also after a restart', () => {
  const first = exitNotices([lesson], [], [], true, opens);
  assert.deepEqual(first.seen, [lessonKey(lesson)]);
  assert.deepEqual(exitNotices([lesson], [], first.seen, true, at(opens, 60_000)).due, []);
});

test('it never fires once the ticket is handed in', () => {
  const handedIn: ExitTicket = {
    teacherId: 'anna',
    lessonId: lesson.id,
    note: '',
    unclear: 'Alles klar',
    ratings: {},
    submittedAt: at(opens, 60_000),
  };
  assert.deepEqual(exitNotices([lesson], [handedIn], [], true, at(opens, 120_000)).due, []);
  // A note written before handing in is no hand-in.
  const noteOnly = { ...handedIn, unclear: '', submittedAt: null };
  assert.deepEqual(exitNotices([lesson], [noteOnly], [], true, at(opens, 120_000)).due, [lesson]);
});

test('it never fires when switched off, nor when switched on again while that ticket is open', () => {
  const off = exitNotices([lesson], [], [], false, opens);
  assert.deepEqual(off.due, []);
  assert.deepEqual(exitNotices([lesson], [], off.seen, true, at(opens, 60_000)).due, []);
});

test('it fires when the teacher opens the ticket early', () => {
  const early = { ...lesson, exitOpenedAt: new Date('2026-11-02T08:30:00+01:00') };
  assert.deepEqual(exitNotices([early], [], [], true, new Date('2026-11-02T08:31:00+01:00')).due, [early]);
});

test('the notification names the course and when the ticket closes', () => {
  const course = { teacherId: 'anna', id: 'inf', name: '3a · Informatik', teacherName: 'Anna Muster', siteUrl: null, checkInStart: null };
  assert.deepEqual(exitNotice(lesson, course), { title: 'Exit-Ticket ist offen', body: '3a · Informatik · offen bis 09:15' });
  assert.deepEqual(exitNotice(lesson, undefined), { title: 'Exit-Ticket ist offen', body: 'Offen bis 09:15' });
});

test('it says when the lesson has an anonymous review', () => {
  const reviewed = { ...lesson, review: ['Was hat dir geholfen?', 'Was sollte sich ändern?'] as [string, string] };
  assert.deepEqual(exitNotice(reviewed, undefined), { title: 'Exit-Ticket ist offen – mit Bewertung', body: 'Offen bis 09:15' });
});
