/**
 * The student's connection: sign-in, sign-out, reading their lessons from
 * `takt_student`, checking in, handing in exit tickets and answering reviews.
 * Row-level security limits every read to the courses the student is enrolled
 * in, and to their own check-ins and tickets; nobody reads a review's answers.
 */
import { createClient, type Session } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { appConfig } from './config';
import { lessonKey, type Course, type Lesson, type MaterialRef, type Semester } from './lessons';
import type { Assessment } from './assessments';
import { checkInStatus, type CheckIn } from './checkin';
import type { ExitTicket, Submission } from './exitTicket';
import type { ReviewSubmission } from './review';

export const config = appConfig(import.meta.env);

// takt_student.status() is a computed column (PostgREST serves a function of
// the row as one), which the generated types don't list on check_ins.
type Schema = Database & { takt_student: { Tables: { check_ins: { Row: { status: string | null } } } } };

// The session lives in the app's own storage (the webview's local storage),
// not the OS keychain: unsigned builds would ask for keychain access again
// after every update.
export const supabase = createClient<Schema, 'takt_student'>(config.supabaseUrl, config.anonKey, {
  db: { schema: 'takt_student' },
  auth: { storageKey: config.sessionKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (error.code === 'invalid_credentials') return 'E-Mail oder Passwort stimmt nicht.';
  if (error.code === 'email_not_confirmed') return 'Bestätige zuerst deine E-Mail-Adresse mit dem Link, den wir dir geschickt haben.';
  return 'Anmelden hat nicht geklappt. Bist du online?';
}

export async function signOut(): Promise<void> {
  // 'local': this device only; the student may be signed in on another.
  await supabase.auth.signOut({ scope: 'local' });
}

export function onSession(fn: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => fn(session));
  return () => data.subscription.unsubscribe();
}

export interface StudentData {
  lessons: Lesson[];
  courses: Course[];
  /** The student's own; RLS hides everyone else's. */
  checkIns: CheckIn[];
  /** The student's own, both parts. */
  exitTickets: ExitTicket[];
  /** The Prüfungen and Abgaben of the student's courses, past and ahead. */
  assessments: Assessment[];
}

// `status` is takt_student.status(), which PostgREST serves as a column.
const CHECK_IN_COLUMNS = 'teacher_id, lesson_id, checked_in_at, status';

function checkInOf(r: { teacher_id: string; lesson_id: string; checked_in_at: string | null; status: string | null }): CheckIn {
  return {
    teacherId: r.teacher_id,
    lessonId: r.lesson_id,
    checkedInAt: r.checked_in_at ? new Date(r.checked_in_at) : null,
    status: checkInStatus(r.status),
  };
}

/**
 * Checks the student in at the server's time. A refusal comes back as the
 * reason `takt_student.check_in()` raised (`check_in_not_open`, ...), or
 * undefined when the request didn't get through.
 */
export async function checkInTo(lesson: Lesson): Promise<{ checkIn: CheckIn } | { refused: string | undefined }> {
  const { data, error } = await supabase
    .rpc('check_in', { teacher: lesson.teacherId, lesson: lesson.id })
    .select(CHECK_IN_COLUMNS)
    .single();
  if (error || !data) return { refused: error?.code === 'P0001' ? error.message : undefined };
  return { checkIn: checkInOf(data) };
}

const TICKET_COLUMNS = 'teacher_id, lesson_id, unclear, ratings, submitted_at, excused';

function ratingsOf(json: unknown): Record<string, number> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  return Object.fromEntries(Object.entries(json).filter((e): e is [string, number] => typeof e[1] === 'number'));
}

/** One ticket from its two rows; a note alone (no ticket row) can't happen, both are written together. */
function exitTicketOf(
  t: { teacher_id: string; lesson_id: string; unclear: string | null; ratings: unknown; submitted_at: string | null; excused: boolean },
  note: string | undefined,
): ExitTicket {
  return {
    teacherId: t.teacher_id,
    lessonId: t.lesson_id,
    note: note ?? '',
    unclear: t.unclear ?? '',
    ratings: ratingsOf(t.ratings),
    submittedAt: t.submitted_at ? new Date(t.submitted_at) : null,
    excused: t.excused,
  };
}

/**
 * Hands in (or edits) the exit ticket at the server's time, both parts. A
 * refusal comes back as the reason `takt_student.submit_exit_ticket()`
 * raised (`exit_ticket_closed`, ...), or undefined when the request didn't
 * get through.
 */
export async function handIn(lesson: Lesson, s: Submission): Promise<{ ticket: ExitTicket } | { refused: string | undefined }> {
  const { data, error } = await supabase
    .rpc('submit_exit_ticket', { teacher: lesson.teacherId, lesson: lesson.id, note: s.note, unclear: s.unclear, ratings: s.ratings })
    .select(TICKET_COLUMNS)
    .single();
  if (error || !data) return { refused: error?.code === 'P0001' ? error.message : undefined };
  return { ticket: exitTicketOf(data, s.note) };
}

/**
 * Answers the lesson's anonymous review. The server returns nothing, so
 * nothing about the answer comes back. A refusal comes back as the reason
 * `takt_student.submit_review()` raised (`review_answered`, ...), or undefined
 * when the request didn't get through.
 */
export async function answerReview(lesson: Lesson, s: ReviewSubmission): Promise<{ answered: true } | { refused: string | undefined }> {
  const { error } = await supabase.rpc('submit_review', {
    teacher: lesson.teacherId,
    lesson: lesson.id,
    rating: s.rating,
    answer_1: s.answer1,
    answer_2: s.answer2,
  });
  if (!error) return { answered: true };
  return { refused: error.code === 'P0001' ? error.message : undefined };
}

/** Has the student answered the lesson's review? Undefined when the request didn't get through. */
export async function reviewAnswered(lesson: Lesson): Promise<boolean | undefined> {
  const { data, error } = await supabase.rpc('review_answered', { teacher: lesson.teacherId, lesson: lesson.id });
  return error ? undefined : data;
}

export async function loadStudentData(): Promise<StudentData> {
  const [lessons, courses, checkIns, tickets, notes, assessments] = await Promise.all([
    supabase.from('lessons').select('*').order('starts_at'),
    supabase.from('courses').select('*'),
    supabase.from('check_ins').select(CHECK_IN_COLUMNS),
    supabase.from('exit_tickets').select(TICKET_COLUMNS),
    supabase.from('exit_notes').select('teacher_id, lesson_id, note'),
    supabase.from('assessments').select(ASSESSMENT_COLUMNS).order('date'),
  ]);
  if (lessons.error) throw lessons.error;
  if (courses.error) throw courses.error;
  if (checkIns.error) throw checkIns.error;
  if (tickets.error) throw tickets.error;
  if (notes.error) throw notes.error;
  if (assessments.error) throw assessments.error;
  // Each course's check-in start: the day only, as a student reads no one else's check-in.
  const starts = await Promise.all(
    courses.data.map((c) => supabase.rpc('check_in_start', { teacher: c.teacher_id, course: c.id })),
  );
  for (const s of starts) if (s.error) throw s.error;
  const noteOf = new Map(notes.data.map((n) => [lessonKey({ teacherId: n.teacher_id, id: n.lesson_id }), n.note]));
  return {
    lessons: lessons.data.map((r) => ({
      teacherId: r.teacher_id,
      id: r.id,
      courseId: r.course_id,
      startsAt: new Date(r.starts_at),
      endsAt: new Date(r.ends_at),
      exitOpenedAt: r.exit_opened_at ? new Date(r.exit_opened_at) : null,
      title: r.title,
      topic: r.topic,
      goals: r.goals,
      standing: r.standing,
      homework: r.homework,
      materials: materialRefs(r.materials),
      review: r.review?.length === 2 ? [r.review[0], r.review[1]] : null,
    })),
    courses: courses.data.map((r, i) => ({
      teacherId: r.teacher_id,
      id: r.id,
      name: r.name,
      teacherName: r.teacher_name,
      checkInStart: starts[i].data ?? null,
      siteUrl: r.site_url,
      semesters: semestersOf(r.semesters),
    })),
    checkIns: checkIns.data.map(checkInOf),
    exitTickets: tickets.data.map((t) => exitTicketOf(t, noteOf.get(lessonKey({ teacherId: t.teacher_id, id: t.lesson_id })))),
    assessments: assessments.data.map(assessmentOf),
  };
}

const ASSESSMENT_COLUMNS = 'teacher_id, id, course_id, date, kind, title, deadline, pages, goals, practice_url, free_text';

/** One row of `takt_student.assessments`; a kind this app doesn't know reads as a Prüfung. */
export function assessmentOf(r: {
  teacher_id: string;
  id: string;
  course_id: string;
  date: string;
  kind: string;
  title: string;
  deadline: string | null;
  pages: unknown;
  goals: string[];
  practice_url: string;
  free_text: string;
}): Assessment {
  return {
    teacherId: r.teacher_id,
    id: r.id,
    courseId: r.course_id,
    date: r.date,
    kind: r.kind === 'hand-in' ? 'hand-in' : 'test',
    title: r.title,
    deadline: r.deadline ? new Date(r.deadline) : null,
    pages: materialRefs(r.pages),
    goals: r.goals,
    practiceUrl: r.practice_url,
    freeText: r.free_text,
  };
}

/** The course summary's `semesters`, `[{start, end}]` as days. */
function semestersOf(json: unknown): Semester[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((s) => (s && typeof s.start === 'string' && typeof s.end === 'string' ? [{ start: s.start, end: s.end }] : []));
}

function materialRefs(json: unknown): MaterialRef[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((m) =>
    m && typeof m === 'object' && typeof m.path === 'string'
      ? [{ title: typeof m.title === 'string' && m.title ? m.title : m.path, path: m.path }]
      : [],
  );
}
