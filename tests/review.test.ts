import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyReview, reviewRefusal, reviewState, reviewSubmissionOf } from '../src/lib/review.ts';
import type { Lesson } from '../src/lib/lessons.ts';

// 08:15–09:00 Zurich time (UTC+1 in winter): the exit ticket, and with it the
// review, opens at 08:50 and closes at 09:15.
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
  review: ['Was hat dir geholfen?', 'Was sollte sich ändern?'],
};

const opens = new Date('2026-11-02T08:50:00+01:00');
const closes = new Date('2026-11-02T09:15:00+01:00');
const at = (d: Date, deltaMs: number) => new Date(d.getTime() + deltaMs);

test('a lesson without a review has no anonymous part', () => {
  const plain = { ...lesson, review: null };
  assert.deepEqual(reviewState(plain, undefined, opens), { kind: 'none' });
  assert.deepEqual(reviewState(plain, false, opens), { kind: 'none' });
});

test('it is open with the exit ticket, with the lesson\'s two prompts', () => {
  assert.deepEqual(reviewState(lesson, false, at(opens, -1)), { kind: 'not-open' });
  assert.deepEqual(reviewState(lesson, false, opens), { kind: 'open', prompts: lesson.review, closesAt: closes });
  assert.deepEqual(reviewState(lesson, false, at(closes, -1)), { kind: 'open', prompts: lesson.review, closesAt: closes });
});

test('it opens early when the teacher opens the exit ticket early', () => {
  const early = { ...lesson, exitOpenedAt: new Date('2026-11-02T08:30:00+01:00') };
  assert.equal(reviewState(early, false, new Date('2026-11-02T08:31:00+01:00')).kind, 'open');
});

test('no form until the server has said whether the student answered', () => {
  assert.deepEqual(reviewState(lesson, undefined, opens), { kind: 'checking' });
});

test('once answered it shows only that, open or closed', () => {
  assert.deepEqual(reviewState(lesson, true, opens), { kind: 'answered' });
  assert.deepEqual(reviewState(lesson, true, closes), { kind: 'answered' });
});

test('it closes with the exit ticket', () => {
  assert.deepEqual(reviewState(lesson, false, closes), { kind: 'closed', closedAt: closes });
  assert.deepEqual(reviewState(lesson, undefined, closes), { kind: 'closed', closedAt: closes });
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
    problem: 'Du hast diese Bewertung schon abgegeben.',
  });
  assert.deepEqual(reviewRefusal('review_closed', lesson), {
    answered: false,
    problem: 'Die Bewertung ist seit 09:15 geschlossen.',
  });
  assert.deepEqual(reviewRefusal('review_not_open', lesson), { answered: false, problem: 'Die Bewertung öffnet um 08:50.' });
  assert.equal(reviewRefusal(undefined, lesson).problem, 'Abgeben hat nicht geklappt. Bist du online?');
});
