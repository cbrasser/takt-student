import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessmentKey, assessmentsOn, countdown, hasDetails, kindLabel, linkify, nextAssessments, upcoming, type Assessment, type Upcoming } from '../src/lib/assessments.ts';
import type { Course, Lesson } from '../src/lib/lessons.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// An Abgabe due Friday 13 November 2026, 18:00 in Zurich.
const deadline = new Date('2026-11-13T18:00:00+01:00');
const before = (ms: number) => new Date(deadline.getTime() - ms);

test('countdown: whole days while a day or more is left', () => {
  assert.equal(countdown(deadline, before(3 * DAY + 5 * HOUR)), 'noch 3 Tage');
  assert.equal(countdown(deadline, before(2 * DAY)), 'noch 2 Tage');
  assert.equal(countdown(deadline, before(DAY)), 'noch 1 Tag');
  assert.equal(countdown(deadline, before(DAY + 23 * HOUR)), 'noch 1 Tag');
});

test('countdown: hours and minutes under 24 hours', () => {
  assert.equal(countdown(deadline, before(DAY - 1)), 'noch 23 Std. 59 Min.');
  assert.equal(countdown(deadline, before(5 * HOUR + 20 * MIN)), 'noch 5 Std. 20 Min.');
  assert.equal(countdown(deadline, before(5 * HOUR + 20 * MIN + 30_000)), 'noch 5 Std. 20 Min.');
  assert.equal(countdown(deadline, before(20 * MIN)), 'noch 20 Min.');
  assert.equal(countdown(deadline, before(30_000)), 'noch weniger als 1 Min.');
});

test('countdown: exactly at the deadline and after it, "abgelaufen"', () => {
  assert.equal(countdown(deadline, deadline), 'abgelaufen');
  assert.equal(countdown(deadline, new Date(deadline.getTime() + 1)), 'abgelaufen');
  assert.equal(countdown(deadline, new Date(deadline.getTime() + 3 * DAY)), 'abgelaufen');
});

const course: Course = { teacherId: 'anna', id: 'inf', name: '3a · Informatik', teacherName: 'Anna Muster', siteUrl: null, checkInStart: null, semesters: [] };

/** A lesson of the course at 08:15–09:00 Zurich time on the given day. */
function lesson(date: string, extra: Partial<Lesson> = {}): Lesson {
  return {
    teacherId: 'anna',
    id: `${date}_0815_inf`,
    courseId: 'inf',
    startsAt: new Date(`${date}T08:15:00+01:00`),
    endsAt: new Date(`${date}T09:00:00+01:00`),
    exitOpenedAt: null,
    title: 'INF',
    topic: `Thema ${date}`,
    goals: [],
    standing: [],
    homework: '',
    materials: [],
    review: null,
    ...extra,
  };
}

function assessment(id: string, date: string, extra: Partial<Assessment> = {}): Assessment {
  return {
    teacherId: 'anna',
    id,
    courseId: 'inf',
    date,
    kind: 'test',
    title: id,
    deadline: null,
    pages: [],
    goals: [],
    practiceUrl: '',
    freeText: '',
    ...extra,
  };
}

/** Each week as "Monday: day [lesson topics | assessment ids]; …". */
const shape = ({ weeks }: Upcoming) =>
  weeks.map((w) => `${w.start}: ${w.days.map((d) => `${d.date} [${[...d.lessons.map((l) => l.topic), ...d.assessments.map((a) => a.id)].join(', ')}]`).join('; ')}`);

// Wednesday 4 November 2026, 10:00 in Zurich.
const now = new Date('2026-11-04T10:00:00+01:00');

test('Demnächst: the course\'s lessons ahead, grouped by week from Monday, up to the semester\'s end', () => {
  const semesters = [
    { start: '2026-08-17', end: '2027-01-29' },
    { start: '2027-02-08', end: '2027-07-02' },
  ];
  const weeks = upcoming(
    [
      lesson('2026-11-02'), // over
      lesson('2026-11-04', { topic: 'heute, vorbei', endsAt: new Date('2026-11-04T09:00:00+01:00') }),
      lesson('2026-11-04', { id: 'later-today', topic: 'heute', startsAt: new Date('2026-11-04T13:00:00+01:00'), endsAt: new Date('2026-11-04T13:45:00+01:00') }),
      lesson('2026-11-06'),
      lesson('2026-11-09'),
      lesson('2027-01-29'), // the semester's last day
      lesson('2027-02-08'), // the next semester
      lesson('2026-11-05', { courseId: 'mat', id: 'other-course' }),
    ],
    [],
    { ...course, semesters },
    now,
  );
  assert.equal(weeks.end, '2027-01-29');
  assert.deepEqual(shape(weeks), [
    '2026-11-02: 2026-11-04 [heute]; 2026-11-06 [Thema 2026-11-06]',
    '2026-11-09: 2026-11-09 [Thema 2026-11-09]',
    '2027-01-25: 2027-01-29 [Thema 2027-01-29]',
  ]);
});

test('Demnächst: without a school year, all lessons ahead', () => {
  const weeks = upcoming([lesson('2026-11-06'), lesson('2027-06-30')], [], course, now);
  assert.equal(weeks.end, null);
  assert.deepEqual(shape(weeks), ['2026-11-02: 2026-11-06 [Thema 2026-11-06]', '2027-06-28: 2027-06-30 [Thema 2027-06-30]']);
});

test('Demnächst: between semesters, up to the next one\'s end; after the last, all lessons ahead', () => {
  const summer = new Date('2027-07-20T10:00:00+02:00');
  const lessons = [lesson('2027-08-18'), lesson('2028-01-26'), lesson('2028-02-09')];
  const next = [{ start: '2027-02-08', end: '2027-07-02' }, { start: '2027-08-16', end: '2028-01-28' }];
  assert.deepEqual(upcoming(lessons, [], { ...course, semesters: next }, summer).weeks.map((w) => w.start), ['2027-08-16', '2028-01-24']);
  assert.deepEqual(upcoming(lessons, [], { ...course, semesters: next.slice(0, 1) }, summer).weeks.map((w) => w.start), ['2027-08-16', '2028-01-24', '2028-02-07']);
});

test('Demnächst: an assessment on a day without a lesson gets its own day; several on one day, Prüfungen first', () => {
  const weeks = upcoming(
    [lesson('2026-11-09')],
    [
      assessment('abgabe-sa', '2026-11-14', { kind: 'hand-in' }),
      assessment('abgabe-mo', '2026-11-09', { kind: 'hand-in', title: 'A' }),
      assessment('pruefung-mo', '2026-11-09', { title: 'Z' }),
      assessment('vorbei', '2026-11-03'),
      assessment('anderer-kurs', '2026-11-10', { courseId: 'mat' }),
    ],
    course,
    now,
  );
  assert.deepEqual(shape(weeks), ['2026-11-09: 2026-11-09 [Thema 2026-11-09, pruefung-mo, abgabe-mo]; 2026-11-14 [abgabe-sa]']);
});

test('Demnächst: an assessment today is still ahead, and a week can hold only assessments', () => {
  const weeks = upcoming([], [assessment('heute', '2026-11-04'), assessment('naechste', '2026-11-11')], course, now);
  assert.deepEqual(shape(weeks), ['2026-11-02: 2026-11-04 [heute]', '2026-11-09: 2026-11-11 [naechste]']);
});

test('overview: the next assessments across all courses, soonest first, at most five; a passed deadline is no longer ahead', () => {
  const next = nextAssessments(
    [
      assessment('spaeter', '2026-11-20'),
      assessment('mathe', '2026-11-05', { courseId: 'mat' }),
      assessment('heute-abgelaufen', '2026-11-04', { kind: 'hand-in', deadline: new Date('2026-11-04T08:00:00+01:00') }),
      assessment('heute-offen', '2026-11-04', { kind: 'hand-in', deadline: new Date('2026-11-04T18:00:00+01:00') }),
      assessment('vorbei', '2026-11-03'),
      assessment('a', '2026-11-06'),
      assessment('b', '2026-11-07'),
      assessment('c', '2026-11-08'),
    ],
    now,
  );
  assert.deepEqual(next.map((a) => a.id), ['heute-offen', 'mathe', 'a', 'b', 'c']);
});

test('badges: a lesson carries its course\'s assessments of its day', () => {
  const monday = lesson('2026-11-09');
  const on = assessmentsOn(monday, [
    assessment('abgabe', '2026-11-09', { kind: 'hand-in' }),
    assessment('pruefung', '2026-11-09'),
    assessment('dienstag', '2026-11-10'),
    assessment('anderer-kurs', '2026-11-09', { courseId: 'mat' }),
  ]);
  assert.deepEqual(on.map((a) => `${a.id} ${kindLabel(a.kind)}`), ['pruefung Prüfung', 'abgabe Abgabe']);
});

test('details: "Details folgen" until pages, goals, a practice link or free text are filled in', () => {
  const bare = assessment('bare', '2026-11-14', { kind: 'hand-in', title: 'Public-Key-Verfahren', deadline: new Date('2026-11-14T18:00:00+01:00') });
  assert.equal(hasDetails(bare), false);
  assert.equal(hasDetails({ ...bare, goals: ['Ich kann RSA erklären.'] }), true);
  assert.equal(hasDetails({ ...bare, pages: [{ title: 'RSA', path: 'Informatik/rsa' }] }), true);
  assert.equal(hasDetails({ ...bare, practiceUrl: 'https://example.org/uebung' }), true);
  assert.equal(hasDetails({ ...bare, freeText: 'Taschenrechner erlaubt.' }), true);
  assert.equal(hasDetails({ ...bare, freeText: '  \n ' }), false);
});

test('details: the free text\'s web addresses become links, without the punctuation after them', () => {
  assert.deepEqual(linkify('Lies https://de.wikipedia.org/wiki/RSA. Oder (http://example.org/a?b=1), fertig.\nZeile 2'), [
    { text: 'Lies ' },
    { text: 'https://de.wikipedia.org/wiki/RSA', url: 'https://de.wikipedia.org/wiki/RSA' },
    { text: '. Oder (' },
    { text: 'http://example.org/a?b=1', url: 'http://example.org/a?b=1' },
    { text: '), fertig.\nZeile 2' },
  ]);
  assert.deepEqual(linkify('Kein Link: javascript:alert(1)'), [{ text: 'Kein Link: javascript:alert(1)' }]);
  assert.deepEqual(linkify(''), []);
});

test('an Abgabe dated before today whose deadline is still ahead stays ahead, under today', () => {
  const late = assessment('frist-spaeter', '2026-11-02', { kind: 'hand-in', deadline: new Date('2026-11-06T18:00:00+01:00') });
  const over = assessment('frist-vorbei', '2026-11-02', { kind: 'hand-in', deadline: new Date('2026-11-03T18:00:00+01:00') });
  assert.deepEqual(shape(upcoming([], [late, over], course, now)), ['2026-11-02: 2026-11-04 [frist-spaeter]']);
  assert.deepEqual(nextAssessments([late, over], now).map((a) => a.id), ['frist-spaeter']);
});

test('an assessment is named by its teacher and its id', () => {
  assert.equal(assessmentKey(assessment('x', '2026-11-09')), 'anna/x');
});
