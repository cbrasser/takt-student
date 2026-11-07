import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyReview, reviewRefusal, reviewState, reviewSubmissionOf } from '../src/lib/review.ts';
import type { Lesson } from '../src/lib/lessons.ts';

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

const opens = new Date('2026-11-02T08:50:00+01:00');
const closes = new Date('2026-11-02T09:15:00+01:00');
const at = (d: Date, deltaMs: number) => new Date(d.getTime() + deltaMs);

test('a lesson without an Umfrage has none, at any time', () => {
  const plain = { ...lesson, review: null };
  assert.deepEqual(reviewState(plain, undefined, opens), { kind: 'none' });
  assert.deepEqual(reviewState(plain, false, opens), { kind: 'none' });
  assert.deepEqual(reviewState(plain, false, at(opens, -1)), { kind: 'none' });
});

test('not open until ten minutes before the end', () => {
  assert.deepEqual(reviewState(lesson, false, at(opens, -1)), { kind: 'not-open' });
  assert.deepEqual(reviewState(lesson, undefined, lesson.startsAt), { kind: 'not-open' });
});

test('open from ten minutes before the end until 15 minutes after it, with the lesson\'s two prompts', () => {
  assert.deepEqual(reviewState(lesson, false, opens), { kind: 'open', prompts: lesson.review, closesAt: closes });
  assert.deepEqual(reviewState(lesson, false, at(closes, -1)), { kind: 'open', prompts: lesson.review, closesAt: closes });
});

test('open early when the teacher opens it early, and closing at the usual time', () => {
  const early = { ...lesson, reviewOpenedAt: new Date('2026-11-02T08:30:00+01:00') };
  assert.deepEqual(reviewState(early, false, new Date('2026-11-02T08:29:00+01:00')), { kind: 'not-open' });
  assert.deepEqual(reviewState(early, false, new Date('2026-11-02T08:30:00+01:00')), { kind: 'open', prompts: lesson.review, closesAt: closes });
  // An early open after the usual one changes nothing.
  const late = { ...lesson, reviewOpenedAt: new Date('2026-11-02T08:55:00+01:00') };
  assert.equal(reviewState(late, false, opens).kind, 'open');
});

test('no form until the server has said whether the student answered', () => {
  assert.deepEqual(reviewState(lesson, undefined, opens), { kind: 'checking' });
});

test('once answered, only that, while it is open', () => {
  assert.deepEqual(reviewState(lesson, true, opens), { kind: 'answered' });
  assert.deepEqual(reviewState(lesson, true, at(closes, -1)), { kind: 'answered' });
});

test('closed 15 minutes after the end, answered or not', () => {
  assert.deepEqual(reviewState(lesson, false, closes), { kind: 'closed' });
  assert.deepEqual(reviewState(lesson, undefined, closes), { kind: 'closed' });
  assert.deepEqual(reviewState(lesson, true, closes), { kind: 'closed' });
});

test('the rating is required; the two answers are optional and trimmed', () => {
  assert.deepEqual(reviewSubmissionOf(emptyReview()), { problem: 'Wähle zuerst eine Bewertung von 1 bis 5.' });
  assert.deepEqual(reviewSubmissionOf({ rating: 4, answer1: '  Die Beispiele. ', answer2: '\n' }), {
    submission: { rating: 4, answer1: 'Die Beispiele.', answer2: '' },
  });
});

test('a second answer reads as answered; the other refusals say why', () => {
  assert.deepEqual(reviewRefusal('review_answered', lesson), {
    answered: true,
    problem: 'Du hast diese Umfrage schon abgegeben.',
  });
  assert.deepEqual(reviewRefusal('review_closed', lesson), {
    answered: false,
    problem: 'Die Umfrage ist seit 09:15 geschlossen.',
  });
  assert.deepEqual(reviewRefusal('review_not_open', lesson), { answered: false, problem: 'Die Umfrage öffnet um 08:50.' });
  assert.deepEqual(reviewRefusal('review_none', lesson), { answered: false, problem: 'Diese Lektion hat keine Umfrage mehr.' });
  assert.equal(reviewRefusal(undefined, lesson).problem, 'Abgeben hat nicht geklappt. Bist du online?');
});
