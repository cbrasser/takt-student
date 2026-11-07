/**
 * The Umfrage: a lesson's anonymous review. Whether it shows, what the form
 * holds, what it sends and what a refusal says. Pure, so it is tested without
 * a database or a clock. The UI calls it "Umfrage"; the code and the database
 * keep `review`.
 *
 * Whether the student has answered comes from the server
 * (`takt_student.review_answered()`) and is kept in memory only: nothing on
 * the device ties the student to what they wrote, and the answer itself is
 * never read back.
 */
import { formatTime } from './format.ts';
import { isReviewOpen, reviewClosesAt, reviewOpensAt, type Lesson } from './lessons.ts';

export type ReviewState =
  /** The lesson has no Umfrage. */
  | { kind: 'none' }
  /** Not open yet: nothing to show. */
  | { kind: 'not-open' }
  /** Open, while the server is asked whether the student has answered. */
  | { kind: 'checking' }
  /** The form, with the lesson's two prompts. */
  | { kind: 'open'; prompts: [string, string]; closesAt: Date }
  /** Open, and answered: "Abgegeben", and nothing of the answer. */
  | { kind: 'answered' }
  /** Closed: nothing to show any more, answered or not. */
  | { kind: 'closed' };

/**
 * The Umfrage at `now`, from ten minutes before the end (or the teacher's
 * early open) until 15 minutes after it. `answered` is undefined until the
 * server has said.
 */
export function reviewState(lesson: Lesson, answered: boolean | undefined, now: Date): ReviewState {
  if (!lesson.review) return { kind: 'none' };
  if (isReviewOpen(lesson, now)) {
    if (answered) return { kind: 'answered' };
    return answered === undefined ? { kind: 'checking' } : { kind: 'open', prompts: lesson.review, closesAt: reviewClosesAt(lesson) };
  }
  return now.getTime() < reviewOpensAt(lesson).getTime() ? { kind: 'not-open' } : { kind: 'closed' };
}

/** What the form holds. */
export interface ReviewDraft {
  /** 1–5; null until chosen. */
  rating: number | null;
  answer1: string;
  answer2: string;
}

export function emptyReview(): ReviewDraft {
  return { rating: null, answer1: '', answer2: '' };
}

/** What `takt_student.submit_review()` takes; an empty answer is none. */
export interface ReviewSubmission {
  rating: number;
  answer1: string;
  answer2: string;
}

/** What "Anonym abgeben" sends, or why it can't yet. */
export function reviewSubmissionOf(draft: ReviewDraft): { submission: ReviewSubmission } | { problem: string } {
  if (draft.rating === null) return { problem: 'Wähle zuerst eine Bewertung von 1 bis 5.' };
  return { submission: { rating: draft.rating, answer1: draft.answer1.trim(), answer2: draft.answer2.trim() } };
}

/**
 * Why the server refused, from the reason `takt_student.submit_review()`
 * raises. A second answer means the student has answered: the leaf then
 * shows "Abgegeben".
 */
export function reviewRefusal(reason: string | undefined, lesson: Lesson): { answered: boolean; problem: string } {
  switch (reason) {
    case 'review_answered':
      return { answered: true, problem: 'Du hast diese Umfrage schon abgegeben.' };
    case 'review_not_open':
      return { answered: false, problem: `Die Umfrage öffnet um ${formatTime(reviewOpensAt(lesson))}.` };
    case 'review_closed':
      return { answered: false, problem: `Die Umfrage ist seit ${formatTime(reviewClosesAt(lesson))} geschlossen.` };
    case 'review_none':
      return { answered: false, problem: 'Diese Lektion hat keine Umfrage mehr.' };
    case 'review_not_enrolled':
      return { answered: false, problem: 'Du bist nicht in diesem Kurs eingeschrieben.' };
    case 'review_invalid_rating':
      return { answered: false, problem: 'Wähle eine Bewertung von 1 bis 5.' };
    default:
      return { answered: false, problem: 'Abgeben hat nicht geklappt. Bist du online?' };
  }
}
