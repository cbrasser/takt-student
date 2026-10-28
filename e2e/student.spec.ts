// The student app, end to end, against the local Supabase stack: Lea signs
// in and her current lesson opens by itself, with its topic, goals and
// material links and without the teacher's cue; the session survives a
// restart and sign-out clears it; Liam, in no Takt course, sees
// "Noch keine Lektionen".
//
// The test plants its own lesson, started a few minutes ago, in the seeded
// course INF-3a (Anna's, with Lea on the roster), so it doesn't depend on
// when the seed last ran.
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'devpassword';
const COURSE = 'seed-inf-3a';
const SITE_URL = 'https://lecture.seed.test/';
const SESSION_KEY = 'takt-student-auth-local';

const takt = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt' }, auth: { persistSession: false, autoRefreshToken: false } });

const stamp = Date.now();
const TOPIC = `Hashfunktionen ${stamp}`;
const GOAL = 'Ich kann erklären, was eine Hashfunktion tut.';
const STANDING = 'XOR und One-Time-Pad sind bekannt.';
const HOMEWORK = 'Blatt 4 lösen';
const CUE = `CUE ${stamp}: Erst nach dem Passwortbeispiel fragen.`;
const NOTES = `Notiz ${stamp}: Mia war krank.`;

let teacherId = '';
let lessonId = '';

/** "2026-11-02_0815" on the Swiss clock: the date and time part of a lesson id. */
function zurichStamp(d: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}${parts.minute}` };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const { data: course, error } = await takt.from('courses').select('teacher_id').eq('id', COURSE).single();
  if (error || !course) throw new Error(`the seed isn't loaded (pnpm db:reset in cbra-platform): ${error?.message}`);
  teacherId = course.teacher_id;

  // Started four or five minutes ago, off the seed's five-minute grid so the
  // id never meets a seeded lesson; later than the seed's "now" lesson, so
  // it is the one that opens.
  const start = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 4 * 60_000);
  if (start.getMinutes() % 5 === 0) start.setMinutes(start.getMinutes() - 1);
  const { date, time } = zurichStamp(start);
  lessonId = `${date}_${time}_${COURSE}`;

  const { error: lessonError } = await takt.from('lessons').insert({
    id: lessonId,
    teacher_id: teacherId,
    course_id: COURSE,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 45 * 60_000).toISOString(),
    minutes: 45,
    breaks: [],
    title: 'INF-3a',
  });
  if (lessonError) throw lessonError;

  const { error: planError } = await takt.from('plans').insert({
    id: lessonId,
    teacher_id: teacherId,
    doc: {
      version: 1, id: lessonId, courseId: COURSE, date, start: `${time.slice(0, 2)}:${time.slice(2)}`,
      lessonTitle: 'INF-3a', minutes: 45, breaks: [], step: 3, updatedAt: 0, status: 'planned',
      topic: TOPIC, intent: 'Sie sollen Hashes von Verschlüsselung unterscheiden.',
      goals: [GOAL], standing: [STANDING], notes: NOTES, homework: HOMEWORK,
      blocks: [
        {
          id: 'e2e-b1', phase: 'input', title: 'Hashes', minutes: 45, cue: CUE,
          materials: [
            { title: 'Hashfunktionen', path: 'Informatik/Kryptologie/hash' },
            { title: 'SHA-2 (Wikipedia)', path: 'https://de.wikipedia.org/wiki/SHA-2' },
          ],
        },
      ],
    },
  });
  if (planError) throw planError;
});

test.afterAll(async () => {
  if (!lessonId) return;
  await takt.from('plans').delete().eq('teacher_id', teacherId).eq('id', lessonId);
  await takt.from('lessons').delete().eq('teacher_id', teacherId).eq('id', lessonId);
});

async function signIn(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('E-Mail').fill(email);
  await page.getByLabel('Passwort').fill(PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
}

test('Lea signs in and her current lesson opens by itself, without the cue', async ({ page }) => {
  await signIn(page, 'lea@seed.test');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOPIC);
  await expect(page.getByText(GOAL)).toBeVisible();
  await expect(page.getByText(STANDING)).toBeVisible();
  await expect(page.getByText(HOMEWORK)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hashfunktionen' })).toHaveAttribute('href', `${SITE_URL}Informatik/Kryptologie/hash`);
  await expect(page.getByRole('link', { name: 'SHA-2 (Wikipedia)' })).toHaveAttribute('href', 'https://de.wikipedia.org/wiki/SHA-2');
  await expect(page.getByRole('heading', { name: 'Letzte Lektion' })).toBeVisible();

  const text = await page.locator('body').innerText();
  expect(text).not.toContain(CUE);
  expect(text).not.toContain(NOTES);
});

test('the session survives a restart, and signing out clears it', async ({ context }) => {
  const first = await context.newPage();
  await signIn(first, 'lea@seed.test');
  await expect(first.getByRole('heading', { level: 1 })).toHaveText(TOPIC);
  await first.close();

  // A restart: a new window on the same storage.
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOPIC);

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)).toBeNull();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
});

test('a wrong password is refused', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-Mail').fill('lea@seed.test');
  await page.getByLabel('Passwort').fill('falsch-falsch');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('alert')).toHaveText('E-Mail oder Passwort stimmt nicht.');
});

test('a student without Takt courses sees "Noch keine Lektionen"', async ({ page }) => {
  await signIn(page, 'liam@seed.test');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Noch keine Lektionen');
});
