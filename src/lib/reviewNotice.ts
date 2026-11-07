/**
 * The "Umfrage ist offen" notification: for which lessons it fires, from what
 * the app's polling read, which Umfragen the student has answered and the
 * time. Pure, so it is tested without a database, a clock or the OS.
 */
import { formatTime } from './format.ts';
import type { Notice } from './notice.ts';
import { isReviewOpen, lessonKey, reviewClosesAt, type Course, type Lesson } from './lessons.ts';

export interface ReviewNotices {
  /** The lessons to notify about now. */
  due: Lesson[];
  /**
   * The lessons whose Umfrage is newly open but not yet known as answered or
   * not: ask the server (`takt_student.review_answered()`), then poll again.
   */
  ask: Lesson[];
  /** The `lessonKey`s seen open, to pass to the next poll; those still to ask aren't among them. */
  seen: string[];
}

/**
 * `answered`: by `lessonKey`, what the server said about the student's answer
 * (kept in memory only); a lesson missing from it hasn't been asked.
 */
export function reviewNotices(
  lessons: Lesson[],
  answered: ReadonlyMap<string, boolean>,
  seen: string[],
  enabled: boolean,
  now: Date,
): ReviewNotices {
  const open = lessons.filter((l) => isReviewOpen(l, now));
  const fresh = enabled ? open.filter((l) => !seen.includes(lessonKey(l))) : [];
  const ask = fresh.filter((l) => !answered.has(lessonKey(l)));
  return {
    due: fresh.filter((l) => answered.get(lessonKey(l)) === false),
    ask,
    seen: open.filter((l) => !ask.includes(l)).map(lessonKey),
  };
}

/** "Umfrage ist offen" / "3a · Informatik · offen bis 09:15" */
export function reviewNotice(lesson: Lesson, course: Course | undefined): Notice {
  const until = `bis ${formatTime(reviewClosesAt(lesson))}`;
  return {
    title: 'Umfrage ist offen',
    body: course ? `${course.name} · offen ${until}` : `Offen ${until}`,
  };
}
