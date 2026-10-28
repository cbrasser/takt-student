/**
 * Which lesson the app shows, from the student's lessons and the time: pure,
 * so it is tested without a database or a clock.
 */

export interface MaterialRef {
  title: string;
  /** A path inside the course's published site, or a full URL. */
  path: string;
}

export interface Lesson {
  teacherId: string;
  id: string;
  courseId: string;
  startsAt: Date;
  endsAt: Date;
  /** When the teacher opened the exit ticket early from Run; null until then. */
  exitOpenedAt: Date | null;
  title: string;
  /** Empty while the teacher hasn't planned the lesson ("Noch kein Thema"). */
  topic: string;
  goals: string[];
  standing: string[];
  homework: string;
  materials: MaterialRef[];
  /** The anonymous review's two prompts; null when the lesson has none. */
  review: [string, string] | null;
}

export interface Course {
  teacherId: string;
  id: string;
  /** As Takt names it: "3a · Informatik". */
  name: string;
  /** The teacher, as the exit ticket names them; null when the server has no name. */
  teacherName: string | null;
  /** The teacher's published site, the base of material paths. */
  siteUrl: string | null;
  /**
   * The day of the course's first check-in or mark ("2026-09-16"), from
   * `takt_student.check_in_start()`: lessons before it, from before check-in
   * existed, have no attendance status. Null while the course has none.
   */
  checkInStart: string | null;
  /** The teacher's school years' semesters, in order ("Demnächst" runs to the current one's end); none without a school year. */
  semesters: Semester[];
}

/** A semester, both ends inclusive, as days on the Swiss clock: "2026-08-17". */
export interface Semester {
  start: string;
  end: string;
}

export interface Home {
  /** The lesson whose window is open, else the one whose exit ticket is: it opens by itself. */
  current: Lesson | null;
  /** The next lesson of each course whose window hasn't opened, soonest first. */
  next: Lesson[];
  /** The lesson that ended last, unless it is still current. */
  last: Lesson | null;
}

/** A lesson is current from this long before its start until its end. */
export const OPENS_BEFORE_MS = 10 * 60_000;

/** Course ids are the teacher's own, so a course is named by both. */
export function courseKey(x: { teacherId: string; courseId?: string; id: string }): string {
  return `${x.teacherId}/${x.courseId ?? x.id}`;
}

/** A lesson is named by its teacher and its id. */
export function lessonKey(l: { teacherId: string; id: string }): string {
  return `${l.teacherId}/${l.id}`;
}

/** When a lesson's window opens: it opens by itself, and "Bereit" shows. */
export function opensAt(l: Lesson): Date {
  return new Date(l.startsAt.getTime() - OPENS_BEFORE_MS);
}

/** Is the lesson's window open, from `opensAt` until its end? */
export function isOpen(l: Lesson, now: Date): boolean {
  const t = now.getTime();
  return opensAt(l).getTime() <= t && t < l.endsAt.getTime();
}

/** The exit ticket opens this long before the end, unless the teacher opens it earlier. */
export const EXIT_OPENS_BEFORE_END_MS = 10 * 60_000;
/** The exit ticket closes this long after the end. */
export const EXIT_CLOSES_AFTER_END_MS = 15 * 60_000;

/** When the exit ticket opens: ten minutes before the end, or the teacher's early open if that is earlier. */
export function exitOpensAt(l: Lesson): Date {
  const usual = l.endsAt.getTime() - EXIT_OPENS_BEFORE_END_MS;
  return new Date(l.exitOpenedAt ? Math.min(usual, l.exitOpenedAt.getTime()) : usual);
}

/** When the exit ticket closes, and the server refuses it. */
export function exitClosesAt(l: Lesson): Date {
  return new Date(l.endsAt.getTime() + EXIT_CLOSES_AFTER_END_MS);
}

/** Is the lesson's exit ticket open, from `exitOpensAt` until `exitClosesAt`? */
export function isExitOpen(l: Lesson, now: Date): boolean {
  const t = now.getTime();
  return exitOpensAt(l).getTime() <= t && t < exitClosesAt(l).getTime();
}

const byStart = (a: Lesson, b: Lesson) => a.startsAt.getTime() - b.startsAt.getTime();

export function home(lessons: Lesson[], now: Date): Home {
  const t = now.getTime();
  const sorted = [...lessons].sort(byStart);

  // Back to back, the next lesson opens before the one before it ends; the
  // later one is the one to get ready for. After its end a lesson stays on
  // while its exit ticket is open, unless the next one has opened.
  const open = sorted.filter((l) => isOpen(l, now));
  const handingIn = sorted.filter((l) => isExitOpen(l, now));
  const current = open[open.length - 1] ?? handingIn[handingIn.length - 1] ?? null;
  const next = new Map<string, Lesson>();
  for (const l of sorted) {
    if (opensAt(l).getTime() > t && !next.has(courseKey(l))) next.set(courseKey(l), l);
  }
  const ended = sorted.filter((l) => l.endsAt.getTime() <= t && l !== current);
  return { current, next: [...next.values()], last: ended[ended.length - 1] ?? null };
}

/**
 * Which lesson stays on show when the current one changes: when a lesson
 * stops being current with nothing in its place (its exit ticket has closed)
 * while the student was following home, it stays, so they see the ticket
 * close; otherwise none, and home decides again. Keys are `lessonKey`s.
 */
export function keptOnShow(was: string | null, current: string | null, followingHome: boolean): string | null {
  return current === null && was !== null && followingHome ? was : null;
}

/** The lesson before `lesson` in its course ("Letzte Lektion"), or null for the first. */
export function previousLesson(lessons: Lesson[], lesson: Lesson): Lesson | null {
  const key = courseKey(lesson);
  const before = lessons
    .filter((l) => courseKey(l) === key && l.startsAt.getTime() < lesson.startsAt.getTime())
    .sort(byStart);
  return before[before.length - 1] ?? null;
}

const WEB = /^https?:\/\//i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Where a material ref links to: a full web URL as it is, a path inside the
 * course's site joined to `siteUrl`. Null when there is nothing safe to link
 * to: no site for a path, or another scheme (javascript:, file:).
 */
export function materialUrl(path: string, siteUrl: string | null): string | null {
  const p = path.trim();
  if (WEB.test(p)) return p;
  if (!p || SCHEME.test(p) || !siteUrl || !WEB.test(siteUrl)) return null;
  const base = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  try {
    const url = new URL(p.replace(/^\/+/, ''), base);
    return WEB.test(url.href) ? url.href : null;
  } catch {
    return null;
  }
}

/** How many course hues the design has (bestanden's year hues). */
export const HUES = 4;

/** The courses in order of their names, as the overview lists them and the hues go. */
export function coursesByName(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => a.name.localeCompare(b.name, 'de-CH') || courseKey(a).localeCompare(courseKey(b)));
}

/** Each course's hue (0 to HUES - 1), given in order of the course names. */
export function courseHues(courses: Course[]): Map<string, number> {
  return new Map(coursesByName(courses).map((c, i) => [courseKey(c), i % HUES]));
}
