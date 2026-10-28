import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseHues, coursesByName, home, keptOnShow, materialUrl, previousLesson, type Course, type Lesson } from '../src/lib/lessons.ts';

const MIN = 60_000;

function lesson(courseId: string, start: string, minutes = 45, extra: Partial<Lesson> = {}): Lesson {
  const startsAt = new Date(start);
  return {
    teacherId: 'anna',
    id: `${start}_${courseId}`,
    courseId,
    startsAt,
    endsAt: new Date(startsAt.getTime() + minutes * MIN),
    exitOpenedAt: null,
    title: courseId,
    topic: '',
    goals: [],
    standing: [],
    homework: '',
    materials: [],
    review: null,
    ...extra,
  };
}

const at = (iso: string, deltaMs = 0) => new Date(new Date(iso).getTime() + deltaMs);

// 08:00–08:45 Zurich time (UTC+1 in winter).
const monday = lesson('inf', '2026-11-02T08:00:00+01:00');
const nextMonday = lesson('inf', '2026-11-09T08:00:00+01:00');
const lastMonday = lesson('inf', '2026-10-26T08:00:00+01:00');
const tuesdayMath = lesson('mat', '2026-11-03T10:00:00+01:00');
const all = [nextMonday, monday, tuesdayMath, lastMonday];

test('a lesson is current from ten minutes before its start', () => {
  assert.equal(home(all, at('2026-11-02T07:50:00+01:00')).current, monday);
});

test('a lesson is not current a moment before its window opens, but next', () => {
  assert.deepEqual(home(all, at('2026-11-02T07:50:00+01:00', -1)), {
    current: null,
    next: [monday, tuesdayMath],
    last: lastMonday,
  });
});

test('a lesson is current until a moment before its end', () => {
  assert.deepEqual(home(all, at('2026-11-02T08:45:00+01:00', -1)), {
    current: monday,
    next: [tuesdayMath, nextMonday],
    last: lastMonday,
  });
});

test('after its end a lesson stays current while its exit ticket is open', () => {
  assert.deepEqual(home(all, at('2026-11-02T09:00:00+01:00', -1)), {
    current: monday,
    next: [tuesdayMath, nextMonday],
    last: lastMonday,
  });
});

test('once its exit ticket closes a lesson is the last one, and each course shows its next lesson', () => {
  assert.deepEqual(home(all, at('2026-11-02T09:00:00+01:00')), {
    current: null,
    next: [tuesdayMath, nextMonday],
    last: monday,
  });
});

test('without any ended lesson there is no last one', () => {
  assert.deepEqual(home([monday], at('2026-11-01T12:00:00+01:00')), { current: null, next: [monday], last: null });
});

test('after every lesson only the last one is left', () => {
  assert.deepEqual(home(all, at('2026-11-20T12:00:00+01:00')), { current: null, next: [], last: nextMonday });
});

test('of two open lessons back to back, the later one is current', () => {
  const first = lesson('inf', '2026-11-02T08:00:00+01:00');
  const second = lesson('mat', '2026-11-02T08:50:00+01:00');
  assert.deepEqual(home([first, second], at('2026-11-02T08:42:00+01:00')), { current: second, next: [], last: null });
});

test('the next lesson\'s window wins over the exit ticket of the one before', () => {
  const first = lesson('inf', '2026-11-02T08:00:00+01:00');
  const second = lesson('mat', '2026-11-02T08:50:00+01:00');
  assert.deepEqual(home([first, second], at('2026-11-02T08:47:00+01:00')), { current: second, next: [], last: first });
});

test('without lessons there is nothing to show', () => {
  assert.deepEqual(home([], at('2026-11-02T08:00:00+01:00')), { current: null, next: [], last: null });
});

test('the previous lesson is the one before in the same course', () => {
  assert.equal(previousLesson(all, nextMonday), monday);
  assert.equal(previousLesson(all, monday), lastMonday);
  assert.equal(previousLesson(all, lastMonday), null);
  assert.equal(previousLesson(all, tuesdayMath), null);
});

test('the previous lesson is looked up by teacher and course', () => {
  const bens = lesson('inf', '2026-11-01T08:00:00+01:00', 45, { teacherId: 'ben' });
  assert.equal(previousLesson([...all, bens], monday), lastMonday);
});

const SITE = 'https://lecture.example.ch/';

test('a material path is resolved against the course site', () => {
  assert.equal(materialUrl('Informatik/Kryptologie/xor', SITE), 'https://lecture.example.ch/Informatik/Kryptologie/xor');
});

test('a site URL without a trailing slash and a path with a leading one still join', () => {
  assert.equal(materialUrl('/Informatik/xor', 'https://lecture.example.ch/kurs'), 'https://lecture.example.ch/kurs/Informatik/xor');
});

test('a full URL is left as it is', () => {
  const url = 'https://de.wikipedia.org/wiki/One-Time-Pad';
  assert.equal(materialUrl(url, SITE), url);
  assert.equal(materialUrl(url, null), url);
});

test('a path without a course site has no link', () => {
  assert.equal(materialUrl('Informatik/xor', null), null);
  assert.equal(materialUrl('Informatik/xor', ''), null);
});

test('only web addresses become links', () => {
  assert.equal(materialUrl('javascript:alert(1)', SITE), null);
  assert.equal(materialUrl('file:///etc/passwd', SITE), null);
  assert.equal(materialUrl('', SITE), null);
});

test('courses take the hues in order of their name, and wrap after four', () => {
  const course = (id: string, name: string): Course => ({ teacherId: 'anna', id, name, teacherName: null, siteUrl: null, checkInStart: null });
  const hues = courseHues([course('e', '5a'), course('a', '1a'), course('c', '3a'), course('b', '2a'), course('d', '4a')]);
  assert.deepEqual(
    ['a', 'b', 'c', 'd', 'e'].map((id) => hues.get(`anna/${id}`)),
    [0, 1, 2, 3, 0],
  );
});

test('the courses in order of their name, the same teacher\'s order for equal names', () => {
  const course = (teacherId: string, id: string, name: string): Course => ({ teacherId, id, name, teacherName: null, siteUrl: null, checkInStart: null });
  const sorted = coursesByName([course('ben', 'x', 'Übungen'), course('anna', 'b', 'Mathe'), course('anna', 'a', 'Mathe'), course('anna', 'c', 'Biologie')]);
  assert.deepEqual(sorted.map((c) => `${c.teacherId}/${c.id}`), ['anna/c', 'anna/a', 'anna/b', 'ben/x']);
});

test('a lesson whose ticket has closed stays on show for a student following home', () => {
  assert.equal(keptOnShow('anna/l1', null, true), 'anna/l1');
});

test('nothing is kept when the next lesson opens, when the student had gone elsewhere, or when nothing was on', () => {
  assert.equal(keptOnShow('anna/l1', 'anna/l2', true), null);
  assert.equal(keptOnShow('anna/l1', null, false), null);
  assert.equal(keptOnShow(null, null, true), null);
  assert.equal(keptOnShow(null, 'anna/l2', true), null);
});
