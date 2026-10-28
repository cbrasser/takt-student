/**
 * The student's connection: sign-in, sign-out and reading their lessons from
 * `takt_student`. Row-level security limits every read to the courses the
 * student is enrolled in.
 */
import { createClient, type Session } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { appConfig } from './config';
import type { Course, Lesson, MaterialRef } from './lessons';
import type { CheckIn, CheckInStatus } from './checkin';

export const config = appConfig(import.meta.env);

// The session lives in the app's own storage (the webview's local storage),
// not the OS keychain: unsigned builds would ask for keychain access again
// after every update.
// takt_student.status() is a computed column (PostgREST serves a function of
// the row as one), which the generated types don't list on check_ins.
type Schema = Database & { takt_student: { Tables: { check_ins: { Row: { status: string | null } } } } };

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
}

// `status` is takt_student.status(), which PostgREST serves as a column.
const CHECK_IN_COLUMNS = 'teacher_id, lesson_id, checked_in_at, status';

function checkInOf(r: { teacher_id: string; lesson_id: string; checked_in_at: string | null; status: string | null }): CheckIn {
  return {
    teacherId: r.teacher_id,
    lessonId: r.lesson_id,
    checkedInAt: r.checked_in_at ? new Date(r.checked_in_at) : null,
    status: (r.status ?? 'missing') as CheckInStatus,
  };
}

/**
 * Checks the student in at the server's time. A refusal comes back as the
 * reason `takt_student.check_in()` raised (`check_in_not_open`, ...), or
 * undefined when the request didn't get through.
 */
export async function checkIn(lesson: Lesson): Promise<{ checkIn: CheckIn } | { refused: string | undefined }> {
  const { data, error } = await supabase
    .rpc('check_in', { teacher: lesson.teacherId, lesson: lesson.id })
    .select(CHECK_IN_COLUMNS)
    .single();
  if (error || !data) return { refused: error?.code === 'P0001' ? error.message : undefined };
  return { checkIn: checkInOf(data) };
}

export async function loadStudentData(): Promise<StudentData> {
  const [lessons, courses, checkIns] = await Promise.all([
    supabase.from('lessons').select('*').order('starts_at'),
    supabase.from('courses').select('*'),
    supabase.from('check_ins').select(CHECK_IN_COLUMNS),
  ]);
  if (lessons.error) throw lessons.error;
  if (courses.error) throw courses.error;
  if (checkIns.error) throw checkIns.error;
  return {
    lessons: lessons.data.map((r) => ({
      teacherId: r.teacher_id,
      id: r.id,
      courseId: r.course_id,
      startsAt: new Date(r.starts_at),
      endsAt: new Date(r.ends_at),
      title: r.title,
      topic: r.topic,
      goals: r.goals,
      standing: r.standing,
      homework: r.homework,
      materials: materialRefs(r.materials),
    })),
    courses: courses.data.map((r) => ({
      teacherId: r.teacher_id,
      id: r.id,
      name: r.name,
      siteUrl: r.site_url,
    })),
    checkIns: checkIns.data.map(checkInOf),
  };
}

function materialRefs(json: unknown): MaterialRef[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((m) =>
    m && typeof m === 'object' && typeof m.path === 'string'
      ? [{ title: typeof m.title === 'string' && m.title ? m.title : m.path, path: m.path }]
      : [],
  );
}
