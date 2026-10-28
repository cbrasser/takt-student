/**
 * The student's connection: sign-in, sign-out and reading their lessons from
 * `takt_student`. Row-level security limits every read to the courses the
 * student is enrolled in.
 */
import { createClient, type Session } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { appConfig } from './config';
import type { Course, Lesson, MaterialRef } from './lessons';

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
  if (error.status === 400) return 'E-Mail oder Passwort stimmt nicht.';
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
}

export async function loadStudentData(): Promise<StudentData> {
  const [lessons, courses] = await Promise.all([
    supabase.from('lessons').select('*').order('starts_at'),
    supabase.from('courses').select('*'),
  ]);
  if (lessons.error) throw lessons.error;
  if (courses.error) throw courses.error;
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
      teacherName: r.teacher_name,
      siteUrl: r.site_url,
    })),
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
