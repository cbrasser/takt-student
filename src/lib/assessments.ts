/**
 * Prüfungen and Abgaben, as students see them ahead: the countdown to an
 * Abgabe's deadline, "Demnächst" grouped by week up to the semester's end,
 * the next ones for the overview and the badges on a lesson. Pure, so it is
 * tested without a database or a clock.
 */
import { isoDay } from './format.ts';
import { courseKey, type Course, type Lesson, type MaterialRef, type Semester } from './lessons.ts';

export type AssessmentKind = 'test' | 'hand-in';

/** A Prüfung or an Abgabe, as `takt_student.assessments` copies it. */
export interface Assessment {
  teacherId: string;
  id: string;
  courseId: string;
  /** Its day on the Swiss clock, "2026-11-09": pinned to the course and day, not to a lesson. */
  date: string;
  kind: AssessmentKind;
  title: string;
  /** An Abgabe's deadline; null for a Prüfung, or an Abgabe without one. */
  deadline: Date | null;
  /** Covered pages, linked like a lesson's materials. */
  pages: MaterialRef[];
  goals: string[];
  /** A web address, or ''. */
  practiceUrl: string;
  /** Plain text, line breaks kept. */
  freeText: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "noch 3 Tage", under 24 hours "noch 5 Std. 20 Min.", from the deadline on "abgelaufen". */
export function countdown(deadline: Date, now: Date): string {
  const left = deadline.getTime() - now.getTime();
  if (left <= 0) return 'abgelaufen';
  if (left >= DAY) {
    const days = Math.floor(left / DAY);
    return days === 1 ? 'noch 1 Tag' : `noch ${days} Tage`;
  }
  const minutes = Math.floor(left / MIN);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `noch ${h} Std. ${m} Min.`;
  return m > 0 ? `noch ${m} Min.` : 'noch weniger als 1 Min.';
}

export interface UpcomingDay {
  /** "2026-11-09" */
  date: string;
  /** Only their topic shows: the copy may hold planned details. */
  lessons: Lesson[];
  /** Prüfungen first, then Abgaben, each by title. */
  assessments: Assessment[];
}

export interface UpcomingWeek {
  /** The week's Monday, "2026-11-09". */
  start: string;
  days: UpcomingDay[];
}

/** The semester holding `today`, else the next one to start; none without a school year or after its last semester. */
export function currentSemester(semesters: Semester[], today: string): Semester | null {
  return semesters.find((s) => s.start <= today && today <= s.end) ?? semesters.find((s) => today < s.start) ?? null;
}

/** "2026-11-09" for any day of that week. */
function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const KIND_ORDER: Record<AssessmentKind, number> = { test: 0, 'hand-in': 1 };

const byKindAndTitle = (a: Assessment, b: Assessment) =>
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title, 'de-CH') || a.id.localeCompare(b.id);

/**
 * "Demnächst": the course's lessons that haven't ended and its assessments
 * from today on, up to the end of the current semester (all of them without
 * one), by day and grouped by week from Monday. An assessment on a day
 * without a lesson has a day of its own.
 */
export function upcomingWeeks(lessons: Lesson[], assessments: Assessment[], course: Course, now: Date): UpcomingWeek[] {
  const key = courseKey(course);
  const today = isoDay(now);
  const end = currentSemester(course.semesters, today)?.end ?? null;
  const ahead = (day: string) => day >= today && (end === null || day <= end);

  const days = new Map<string, UpcomingDay>();
  const dayOf = (date: string) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, lessons: [], assessments: [] }));
    return d;
  };
  for (const l of [...lessons].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const day = isoDay(l.startsAt);
    if (courseKey(l) === key && l.endsAt.getTime() > now.getTime() && ahead(day)) dayOf(day).lessons.push(l);
  }
  for (const a of [...assessments].sort(byKindAndTitle)) {
    if (courseKey(a) === key && ahead(a.date)) dayOf(a.date).assessments.push(a);
  }

  const weeks = new Map<string, UpcomingWeek>();
  for (const d of [...days.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    const start = mondayOf(d.date);
    let w = weeks.get(start);
    if (!w) weeks.set(start, (w = { start, days: [] }));
    w.days.push(d);
  }
  return [...weeks.values()];
}

const KIND_LABEL: Record<AssessmentKind, string> = { test: 'Prüfung', 'hand-in': 'Abgabe' };

/** "Prüfung" or "Abgabe": the badge and the details page's caption. */
export function kindLabel(kind: AssessmentKind): string {
  return KIND_LABEL[kind];
}

/** Has the teacher filled in anything beyond the title and date? Else the details page says "Details folgen". */
export function hasDetails(a: Assessment): boolean {
  return a.pages.length > 0 || a.goals.length > 0 || a.practiceUrl !== '' || a.freeText.trim() !== '';
}

const OVERVIEW_MAX = 5;

/**
 * The overview's next assessments across all courses: from today on, soonest
 * first, at most five. An Abgabe whose deadline has passed is no longer ahead.
 */
export function nextAssessments(assessments: Assessment[], now: Date): Assessment[] {
  const today = isoDay(now);
  return assessments
    .filter((a) => a.date >= today && (a.deadline === null || a.deadline.getTime() > now.getTime()))
    .sort((a, b) => a.date.localeCompare(b.date) || byKindAndTitle(a, b))
    .slice(0, OVERVIEW_MAX);
}

/** The badges of a lesson: its course's assessments on its day, Prüfungen first. */
export function assessmentsOn(lesson: Lesson, assessments: Assessment[]): Assessment[] {
  const key = courseKey(lesson);
  const day = isoDay(lesson.startsAt);
  return assessments.filter((a) => courseKey(a) === key && a.date === day).sort(byKindAndTitle);
}

/** A run of the free text: plain, or a web address to link. */
export interface TextPart {
  text: string;
  url?: string;
}

// A web address up to white space, without the punctuation that usually ends a sentence after it.
const URL = /https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]'»]/gi;

/** The free text in runs, its web addresses (http and https only) as links. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(URL)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ text: m[0], url: m[0] });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
