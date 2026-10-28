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
  title: string;
  /** Empty while the teacher hasn't planned the lesson ("Noch kein Thema"). */
  topic: string;
  goals: string[];
  standing: string[];
  homework: string;
  materials: MaterialRef[];
}

export interface Course {
  teacherId: string;
  id: string;
  /** As Takt names it: "3a · Informatik". */
  name: string;
  /** The teacher's published site, the base of material paths. */
  siteUrl: string | null;
}

export interface Home {
  /** The lesson whose window is open: it opens by itself. */
  current: Lesson | null;
  /** The next lesson of each course whose window hasn't opened, soonest first. */
  next: Lesson[];
  /** The lesson that ended last. */
  last: Lesson | null;
}

/** A lesson is current from this long before its start until its end. */
export const OPENS_BEFORE_MS = 10 * 60_000;

/** Course ids are the teacher's own, so a course is named by both. */
export function courseKey(x: { teacherId: string; courseId?: string; id: string }): string {
  return `${x.teacherId}/${x.courseId ?? x.id}`;
}

/** A lesson is named by its teacher and its id. */
export function lessonKey(l: Lesson): string {
  return `${l.teacherId}/${l.id}`;
}

const opensAt = (l: Lesson) => l.startsAt.getTime() - OPENS_BEFORE_MS;
const byStart = (a: Lesson, b: Lesson) => a.startsAt.getTime() - b.startsAt.getTime();

export function home(lessons: Lesson[], now: Date): Home {
  const t = now.getTime();
  const sorted = [...lessons].sort(byStart);

  // Back to back, the next lesson opens before the one before it ends; the
  // later one is the one to get ready for.
  const open = sorted.filter((l) => opensAt(l) <= t && t < l.endsAt.getTime());
  const next = new Map<string, Lesson>();
  for (const l of sorted) {
    if (opensAt(l) > t && !next.has(courseKey(l))) next.set(courseKey(l), l);
  }
  const ended = sorted.filter((l) => l.endsAt.getTime() <= t);
  return { current: open[open.length - 1] ?? null, next: [...next.values()], last: ended[ended.length - 1] ?? null };
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

/** Each course's hue (0 to HUES - 1), given in order of the course names. */
export function courseHues(courses: Course[]): Map<string, number> {
  const sorted = [...courses].sort((a, b) => a.name.localeCompare(b.name, 'de-CH') || courseKey(a).localeCompare(courseKey(b)));
  return new Map(sorted.map((c, i) => [courseKey(c), i % HUES]));
}
