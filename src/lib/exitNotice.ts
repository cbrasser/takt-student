/**
 * The "Exit-Ticket ist offen" notification: for which lessons it fires, from
 * what the app's polling read and the time. Pure, so it is tested without a
 * database, a clock or the OS.
 */
import type { ExitTicket } from './exitTicket.ts';
import { formatTime } from './format.ts';
import { exitClosesAt, isExitOpen, lessonKey, type Course, type Lesson } from './lessons.ts';

export interface ExitNotices {
  /** The lessons to notify about now. */
  due: Lesson[];
  /** The `lessonKey`s seen open, to pass to the next poll. */
  seen: string[];
}

export function exitNotices(lessons: Lesson[], tickets: ExitTicket[], seen: string[], enabled: boolean, now: Date): ExitNotices {
  const open = lessons.filter((l) => isExitOpen(l, now));
  const handedIn = new Set(tickets.filter((t) => t.submittedAt).map((t) => lessonKey({ teacherId: t.teacherId, id: t.lessonId })));
  return {
    due: enabled ? open.filter((l) => !seen.includes(lessonKey(l)) && !handedIn.has(lessonKey(l))) : [],
    seen: open.map(lessonKey),
  };
}

/** What the OS notification says. */
export interface Notice {
  title: string;
  body: string;
}

/** "Exit-Ticket ist offen" / "3a · Informatik · offen bis 09:15" */
export function exitNotice(lesson: Lesson, course: Course | undefined): Notice {
  const until = `bis ${formatTime(exitClosesAt(lesson))}`;
  return { title: 'Exit-Ticket ist offen', body: course ? `${course.name} · offen ${until}` : `Offen ${until}` };
}
