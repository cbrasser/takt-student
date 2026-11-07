// The Verlauf, end to end, against the local Supabase stack. Every past
// lesson looks the same: topic, goals, homework, materials and badges, with
// no status and no exit ticket, though the seed still holds Lea's check-in
// and ticket for last week's lesson. Lea saves her Verlauf as Markdown.
//
// The seed's lessons of last week and two weeks ago are in INF-3a; the test
// also plants a lesson three days ago, with goals and homework.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'devpassword';
const COURSE = 'seed-inf-3a';
const SEED_TOPIC = 'Caesar-Verschlüsselung';
const BACKFILLED_TOPIC = 'Geheimschriften im Alltag';
// What the seed's exit ticket of Lea's says, which the Verlauf no longer shows.
const LEA_NOTE = 'Caesar verschiebt jeden Buchstaben um gleich viele Stellen.';
const LEA_UNCLEAR = 'Wie knackt man Caesar, ohne alle 25 Schlüssel auszuprobieren?';
/** Anything of a status or a ticket. */
const STATUS = /pünktlich|zu spät|entschuldigt|anwesend|verpasst|Abgegeben|Exit-Ticket|von 4/;

const auth = { persistSession: false, autoRefreshToken: false };
const takt = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt' }, auth });
const student = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt_student' }, auth });

const stamp = Date.now();
const PLANTED_TOPIC = `Skytale ${stamp}`;
const PLANTED_GOAL = 'Ich kann eine Skytale erklären.';
const PLANTED_HOMEWORK = 'Skytale basteln';

let teacherId = '';
let courseName = '';
let plantedId = '';

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
  plantedId = `${date}_${time}_${COURSE}`;
  const { error: lessonError } = await takt.from('lessons').insert({
    id: plantedId,
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
    id: plantedId,
    teacher_id: teacherId,
    doc: {
      version: 1, id: plantedId, courseId: COURSE, date, start: `${time.slice(0, 2)}:${time.slice(2)}`,
      lessonTitle: 'INF-3a', minutes: 45, breaks: [], step: 3, updatedAt: 0, status: 'planned',
      topic: PLANTED_TOPIC, goals: [PLANTED_GOAL], standing: [], homework: PLANTED_HOMEWORK, blocks: [],
      review: { prompts: ['Was hast du gut verstanden?', 'Was war unklar?'] },
    },
  });
  if (planError) throw planError;
});

test.afterAll(async () => {
  if (!plantedId) return;
  await takt.from('plans').delete().eq('teacher_id', teacherId).eq('id', plantedId);
  await takt.from('lessons').delete().eq('teacher_id', teacherId).eq('id', plantedId);
});

/** Signs in and opens the course's Verlauf from the overview. */
async function openHistory(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('E-Mail').fill(email);
  await page.getByLabel('Passwort').fill(PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  // A running lesson opens by itself; the Verlauf is on the overview.
  const overview = page.getByRole('button', { name: 'Übersicht' });
  const courses = page.getByRole('region', { name: 'Deine Kurse' });
  await expect(overview.or(courses)).toBeVisible();
  if (await overview.isVisible()) await overview.click();
  await courses.getByRole('button', { name: `Verlauf · ${courseName}` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verlauf');
}

const pastLesson = (page: Page, topic: string) => page.getByRole('article', { name: topic });

test('Lea sees her past lessons alike, newest first, without status or ticket', async ({ page }) => {
  await openHistory(page, 'lea@seed.test');

  const seeded = pastLesson(page, SEED_TOPIC);
  await expect(seeded).toContainText('Arbeitsblatt Caesar fertig lösen');
  await expect(seeded.getByRole('link', { name: 'Caesar' })).toHaveAttribute('href', 'https://lecture.seed.test/Informatik/Kryptologie/caesar');
  await expect(seeded).not.toContainText(LEA_NOTE);
  await expect(seeded).not.toContainText(LEA_UNCLEAR);

  const planted = pastLesson(page, PLANTED_TOPIC);
  await expect(planted).toContainText(PLANTED_GOAL);
  await expect(planted).toContainText(PLANTED_HOMEWORK);
  await expect(planted).not.toContainText('Umfrage');

  await expect(pastLesson(page, BACKFILLED_TOPIC)).toBeVisible();
  await expect(page.getByText(STATUS)).toHaveCount(0);

  const topics = await page.getByRole('article').getByRole('heading', { level: 2 }).allTextContents();
  expect(topics.indexOf(PLANTED_TOPIC)).toBeLessThan(topics.indexOf(SEED_TOPIC));
  expect(topics.indexOf(SEED_TOPIC)).toBeLessThan(topics.indexOf(BACKFILLED_TOPIC));
});

test('Lea saves her Verlauf as Markdown: the lessons only', async ({ page }) => {
  await openHistory(page, 'lea@seed.test');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als Markdown speichern' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`Verlauf ${courseName}.md`);

  const text = readFileSync(await download.path(), 'utf8');
  expect(text.startsWith(`# ${courseName}\n`)).toBe(true);
  expect(text).toContain(`· ${SEED_TOPIC}\n`);
  expect(text).toContain(`- ${PLANTED_GOAL}`);
  expect(text).toContain(`> ${PLANTED_HOMEWORK}`);
  // Each lesson's line under its heading is its time, nothing more.
  expect(text).toMatch(new RegExp(`· ${PLANTED_TOPIC}\\n\\n\\d\\d:\\d\\d–\\d\\d:\\d\\d\\n`));
  expect(text).toMatch(new RegExp(`· ${SEED_TOPIC}\\n\\n\\d\\d:\\d\\d–\\d\\d:\\d\\d\\n`));
  expect(text).not.toMatch(STATUS);
  expect(text).not.toContain(LEA_NOTE);
  expect(text).not.toContain(LEA_UNCLEAR);
  expect(text).not.toContain('Was war unklar?');
  // Oldest first, as notes are read.
  expect(text.indexOf(BACKFILLED_TOPIC)).toBeLessThan(text.indexOf(SEED_TOPIC));
  expect(text.indexOf(SEED_TOPIC)).toBeLessThan(text.indexOf(PLANTED_TOPIC));
});
