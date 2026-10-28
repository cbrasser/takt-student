// "Demnächst", end to end, against the local Supabase stack. The seed gives
// INF-3a a Prüfung on next week's lesson, with pages, goals, a practice link
// and free text, and an Abgabe a week later on a day without a lesson, with
// only its title and a deadline at 18:00, so its details page says "Details
// folgen". Lea sees both on the overview and in Demnächst, opens each details
// page, and sees the "Prüfung" badge on next week's lesson. The seed has no
// school year, so Demnächst shows every lesson ahead.
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'devpassword';
const COURSE = 'seed-inf-3a';
const TEST_TITLE = 'Prüfung Kryptologie';
const HAND_IN_TITLE = 'Public-Key-Verfahren';

const auth = { persistSession: false, autoRefreshToken: false };
const student = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt_student' }, auth });

let courseName = '';
/** The topic of the lesson on the Prüfung's day, as students read it. */
let testLessonTopic = '';

test.beforeAll(async () => {
  const { data: course, error } = await student.from('courses').select('name').eq('id', COURSE).single();
  if (error || !course) throw new Error(`the seed isn't loaded (pnpm db:reset in cbra-platform): ${error?.message}`);
  courseName = course.name;
  const { data: exam } = await student.from('assessments').select('teacher_id, date').eq('id', 'seed-assessment-test').single();
  if (!exam) throw new Error('the seed has no Prüfung (cbra-platform#21)');
  const { data: lesson } = await student.from('lessons').select('topic').eq('teacher_id', exam.teacher_id).eq('course_id', COURSE).eq('date', exam.date).single();
  testLessonTopic = lesson?.topic || 'Noch kein Thema';
});

/** Signs in as Lea and goes to the overview (a running lesson opens by itself). */
async function overview(page: Page) {
  await page.goto('/');
  await page.getByLabel('E-Mail').fill('lea@seed.test');
  await page.getByLabel('Passwort').fill(PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  const back = page.getByRole('button', { name: 'Übersicht' });
  const courses = page.getByRole('region', { name: 'Deine Kurse' });
  await expect(back.or(courses)).toBeVisible();
  if (await back.isVisible()) await back.click();
  await expect(courses).toBeVisible();
}

test('the overview lists the next Prüfung and Abgabe, the Abgabe with its countdown', async ({ page }) => {
  await overview(page);
  const next = page.getByRole('region', { name: 'Prüfungen und Abgaben' });
  await expect(next.getByRole('button', { name: new RegExp(TEST_TITLE) })).toBeVisible();
  await expect(next.getByRole('button', { name: new RegExp(HAND_IN_TITLE) })).toContainText(/noch \d+ Tage/);
});

test('Lea opens Demnächst, sees the Prüfung and the Abgabe, and the badge on next week\'s lesson', async ({ page }) => {
  await overview(page);
  await page.getByRole('button', { name: `Demnächst · ${courseName}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demnächst');
  await expect(page.getByText('Alle kommenden Lektionen.')).toBeVisible();

  await expect(page.getByRole('button', { name: new RegExp(TEST_TITLE) })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(HAND_IN_TITLE) })).toContainText(/noch \d+ Tage/);

  const testLesson = page.getByRole('listitem').filter({ hasText: testLessonTopic }).filter({ hasNotText: TEST_TITLE });
  await expect(testLesson.getByText('Prüfung', { exact: true })).toBeVisible();
});

test('the Prüfung\'s details page: pages as links, goals, the practice link and the free text\'s link', async ({ page }) => {
  await overview(page);
  await page.getByRole('button', { name: `Demnächst · ${courseName}` }).click();
  await page.getByRole('button', { name: new RegExp(TEST_TITLE) }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TEST_TITLE);
  await expect(page.getByRole('link', { name: 'Caesar' })).toHaveAttribute('href', 'https://lecture.seed.test/Informatik/Kryptologie/caesar');
  await expect(page.getByRole('link', { name: 'XOR' })).toHaveAttribute('href', 'https://lecture.seed.test/Informatik/Kryptologie/xor');
  await expect(page.getByText('Ich kann XOR auf Bits anwenden.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Übungsaufgaben' })).toHaveAttribute('href', 'https://lecture.seed.test/Informatik/Kryptologie/uebungstest');
  await expect(page.getByText('Taschenrechner erlaubt.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'https://de.wikipedia.org/wiki/H%C3%A4ufigkeitsanalyse' })).toBeVisible();
  await expect(page.getByText('Details folgen.')).toHaveCount(0);
});

test('the Abgabe\'s details page: its deadline and "Details folgen"', async ({ page }) => {
  await overview(page);
  await page.getByRole('region', { name: 'Prüfungen und Abgaben' }).getByRole('button', { name: new RegExp(HAND_IN_TITLE) }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(HAND_IN_TITLE);
  await expect(page.getByText(/^Abgabe bis .+, 18:00 · noch \d+ Tage$/)).toBeVisible();
  await expect(page.getByText('Details folgen.')).toBeVisible();

  await page.getByRole('button', { name: `Demnächst in ${courseName}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demnächst');
});
