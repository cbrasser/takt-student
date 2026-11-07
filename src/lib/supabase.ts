/**
 * The student's connection: sign-in, sign-out, reading their lessons from
 * `takt_student` and answering the Umfrage (the anonymous review). Row-level
 * security limits every read to the courses the student is enrolled in;
 * nobody reads a review's answers.
 */
import { createClient, type Session } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { appConfig } from './config';
import type { Course, Lesson, MaterialRef, Semester } from './lessons';
import type { Assessment } from './assessments';
import type { ReviewSubmission } from './review';

export const config = appConfig(import.meta.env);

// The session lives in the app's own storage (the webview's local storage),
// not the OS keychain: unsigned builds would ask for keychain access again
// after every update.
export const supabase = createClient<Database, 'takt_student'>(config.supabaseUrl, config.anonKey, {
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
  /** The Prüfungen and Abgaben of the student's courses, past and ahead. */
  assessments: Assessment[];
}

/**
 * Answers the lesson's Umfrage, its anonymous review. The server returns
 * nothing, so nothing about the answer comes back. A refusal comes back as the
 * reason `takt_student.submit_review()` raised (`review_answered`, ...), or
 * undefined when the request didn't get through.
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

/** Has the student answered the lesson's Umfrage? Undefined when the request didn't get through. */
export async function reviewAnswered(lesson: Lesson): Promise<boolean | undefined> {
  const { data, error } = await supabase.rpc('review_answered', { teacher: lesson.teacherId, lesson: lesson.id });
  return error ? undefined : data;
}

const ASSESSMENT_COLUMNS = 'teacher_id, id, course_id, date, kind, title, deadline, pages, goals, practice_url, free_text';

/** One row of `takt_student.assessments`; a kind this app doesn't know reads as a Prüfung. */
function assessmentOf(r: {
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

export async function loadStudentData(): Promise<StudentData> {
  const [lessons, courses, assessments] = await Promise.all([
    supabase.from('lessons').select('*').order('starts_at'),
    supabase.from('courses').select('*'),
    supabase.from('assessments').select(ASSESSMENT_COLUMNS).order('date'),
  ]);
  if (lessons.error) throw lessons.error;
  if (courses.error) throw courses.error;
  if (assessments.error) throw assessments.error;
  return {
    lessons: lessons.data.map((r) => ({
      teacherId: r.teacher_id,
      id: r.id,
      courseId: r.course_id,
      startsAt: new Date(r.starts_at),
      endsAt: new Date(r.ends_at),
      reviewOpenedAt: r.exit_opened_at ? new Date(r.exit_opened_at) : null,
      title: r.title,
      topic: r.topic,
      goals: r.goals,
      standing: r.standing,
      homework: r.homework,
      materials: materialRefs(r.materials),
      review: r.review?.length === 2 ? [r.review[0], r.review[1]] : null,
    })),
    courses: courses.data.map((r) => ({
      teacherId: r.teacher_id,
      id: r.id,
      name: r.name,
      siteUrl: r.site_url,
      semesters: semestersOf(r.semesters),
    })),
    assessments: assessments.data.map(assessmentOf),
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
