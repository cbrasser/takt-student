// The Verlauf, end to end, against the local Supabase stack. The seed's
// lesson of last week in INF-3a has one of each ticket state: Lea checked in
// on time and handed in (with a private note), Noah checked in and handed in
// nothing, Mia came late and her missing ticket is excused. Each sees only
// their own status and ticket there; Lea saves her Verlauf as Markdown.
//
// The seed's lesson of two weeks ago predates the course's first check-in, as
// a lesson Takt backfilled would: it has no status. The test also plants a
// lesson three days ago, after check-in started, which nobody checked in to,
// so Lea sees a missed lesson ("verpasst") too.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'devpassword';
const COURSE = 'seed-inf-3a';
const SEED_TOPIC = 'Caesar-Verschlüsselung';
const BACKFILLED_TOPIC = 'Geheimschriften im Alltag';
const LEA_NOTE = 'Caesar verschiebt jeden Buchstaben um gleich viele Stellen.';
const LEA_UNCLEAR = 'Wie knackt man Caesar, ohne alle 25 Schlüssel auszuprobieren?';

const auth = { persistSession: false, autoRefreshToken: false };
const takt = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt' }, auth });
const student = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt_student' }, auth });

const stamp = Date.now();
const MISSED_TOPIC = `Skytale ${stamp}`;

let teacherId = '';
let courseName = '';
let missedId = '';

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
  const { data: course, error } = await student.from('courses').select('teacher_id, name').eq('id', COURSE).single();
  if (error || !course) throw new Error(`the seed isn't loaded (pnpm db:reset in cbra-platform): ${error?.message}`);
  teacherId = course.teacher_id;
  courseName = course.name;

  // Three days ago, off the seed's five-minute grid so the id never meets a
  // seeded lesson.
  const start = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 3 * 24 * 60 * 60_000);
  if (start.getMinutes() % 5 === 0) start.setMinutes(start.getMinutes() - 1);
  const { date, time } = zurichStamp(start);
  missedId = `${date}_${time}_${COURSE}`;
  const { error: lessonError } = await takt.from('lessons').insert({
    id: missedId,
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
    id: missedId,
    teacher_id: teacherId,
    doc: {
      version: 1, id: missedId, courseId: COURSE, date, start: `${time.slice(0, 2)}:${time.slice(2)}`,
      lessonTitle: 'INF-3a', minutes: 45, breaks: [], step: 3, updatedAt: 0, status: 'planned',
      topic: MISSED_TOPIC, goals: [], standing: [], homework: 'Skytale basteln', blocks: [],
    },
  });
  if (planError) throw planError;
});

test.afterAll(async () => {
  if (!missedId) return;
  await takt.from('plans').delete().eq('teacher_id', teacherId).eq('id', missedId);
  await takt.from('lessons').delete().eq('teacher_id', teacherId).eq('id', missedId);
});

/** Signs in and opens the course's Verlauf from the overview. */
async function openHistory(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('E-Mail').fill(email);
  await page.getByLabel('Passwort').fill(PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  // A running lesson opens by itself; the Verlauf is on the overview.
  const overview = page.getByRole('button', { name: 'Übersicht' });
  const courses = page.getByRole('region', { name: 'Verlauf' });
  await expect(overview.or(courses)).toBeVisible();
  if (await overview.isVisible()) await overview.click();
  await courses.getByRole('button', { name: courseName }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verlauf');
}

const pastLesson = (page: Page, topic: string) => page.getByRole('article', { name: topic });

test('Lea sees her past lessons with her status and her ticket, newest first', async ({ page }) => {
  await openHistory(page, 'lea@seed.test');

  const seeded = pastLesson(page, SEED_TOPIC);
  await expect(seeded).toContainText('pünktlich');
  await expect(seeded).toContainText(/Abgegeben \d\d:\d\d/);
  await expect(seeded).toContainText(LEA_NOTE);
  await expect(seeded).toContainText(LEA_UNCLEAR);
  await expect(seeded).toContainText('3 von 4');
  await expect(seeded).toContainText('Arbeitsblatt Caesar fertig lösen');
  await expect(seeded.getByRole('link', { name: 'Caesar' })).toHaveAttribute('href', 'https://lecture.seed.test/Informatik/Kryptologie/caesar');
  await expect(seeded).not.toContainText('Exit-Ticket fehlt');

  const missed = pastLesson(page, MISSED_TOPIC);
  await expect(missed).toContainText('verpasst');
  await expect(missed).not.toContainText('Exit-Ticket');

  const topics = await page.getByRole('article').getByRole('heading', { level: 2 }).allTextContents();
  expect(topics.indexOf(MISSED_TOPIC)).toBeLessThan(topics.indexOf(SEED_TOPIC));
});

test('a lesson from before check-in started shows no status in Lea\'s Verlauf', async ({ page }) => {
  await openHistory(page, 'lea@seed.test');
  const backfilled = pastLesson(page, BACKFILLED_TOPIC);
  await expect(backfilled).toBeVisible();
  await expect(backfilled).not.toContainText('verpasst');
  await expect(backfilled).not.toContainText('Exit-Ticket');
  await expect(backfilled).not.toContainText('pünktlich');
});

test('Lea saves her Verlauf as Markdown', async ({ page }) => {
  await openHistory(page, 'lea@seed.test');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als Markdown speichern' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`Verlauf ${courseName}.md`);

  const text = readFileSync(await download.path(), 'utf8');
  expect(text.startsWith(`# ${courseName}\n`)).toBe(true);
  expect(text).toContain(`· ${SEED_TOPIC}\n`);
  expect(text).toMatch(/\d\d:\d\d–\d\d:\d\d · pünktlich · Abgegeben \d\d:\d\d/);
  expect(text).toContain(`> ${LEA_NOTE}`);
  expect(text).toContain(`> ${LEA_UNCLEAR}`);
  expect(text).toContain(`· ${MISSED_TOPIC}\n`);
  expect(text).toMatch(/· verpasst\n/);
  // Before check-in started, no status.
  expect(text).toMatch(new RegExp(`· ${BACKFILLED_TOPIC}\\n\\n\\d\\d:\\d\\d–\\d\\d:\\d\\d\\n`));
  // Oldest first, as notes are read.
  expect(text.indexOf(BACKFILLED_TOPIC)).toBeLessThan(text.indexOf(SEED_TOPIC));
  expect(text.indexOf(SEED_TOPIC)).toBeLessThan(text.indexOf(MISSED_TOPIC));
});

test('Noah, present without a ticket, sees "Exit-Ticket fehlt", and nothing of Lea\'s', async ({ page }) => {
  await openHistory(page, 'noah@seed.test');
  const seeded = pastLesson(page, SEED_TOPIC);
  await expect(seeded).toContainText('pünktlich');
  await expect(seeded).toContainText('Exit-Ticket fehlt');
  await expect(seeded).not.toContainText(LEA_NOTE);
  await expect(seeded).not.toContainText(LEA_UNCLEAR);
});

test('Mia, late with her missing ticket excused, sees that', async ({ page }) => {
  await openHistory(page, 'mia@seed.test');
  const seeded = pastLesson(page, SEED_TOPIC);
  await expect(seeded).toContainText('zu spät');
  await expect(seeded).toContainText('Exit-Ticket entschuldigt');
  await expect(seeded).not.toContainText('Exit-Ticket fehlt');
});
