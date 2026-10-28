// The exit ticket, end to end, against the local Supabase stack: Lea's
// lesson is running and the teacher has opened the exit ticket early; Lea
// reads who sees what, hands in, sees her answers again after a restart,
// edits them (the first submission time stays) and, once the ticket has
// closed, sees that it has.
//
// The test plants its own lesson, started a minute or two ago, in the seeded
// course INF-3a, and opens its exit ticket as the teacher's early open does,
// by stamping `exit_opened_at` on takt.lessons.
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'devpassword';
const COURSE = 'seed-inf-3a';
const LEA_ROSTER = '57d50000-0000-0000-0000-000000000001';

const auth = { persistSession: false, autoRefreshToken: false };
const takt = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt' }, auth });
const student = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt_student' }, auth });

const stamp = Date.now();
const TOPIC = `Hashfunktionen ${stamp}`;
const GOALS = ['Ich kann erklären, was eine Hashfunktion tut.', 'Ich kann eine Kollision erklären.'];
const NOTE = `Wir haben SHA-256 ausprobiert (${stamp}).`;
const UNCLEAR = 'Warum kann man einen Hash nicht zurückrechnen?';

let teacherId = '';
let teacherName = '';
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
  const { data: course, error } = await student.from('courses').select('teacher_id, teacher_name').eq('id', COURSE).single();
  if (error || !course) throw new Error(`the seed isn't loaded (pnpm db:reset in cbra-platform): ${error?.message}`);
  teacherId = course.teacher_id;
  teacherName = course.teacher_name ?? '';

  // Started a minute or two ago, off the seed's five-minute grid, later than
  // the seed's "now" lesson, so it is the one that opens.
  const start = new Date(Math.floor(Date.now() / 60_000) * 60_000 - 60_000);
  if (start.getMinutes() % 5 === 0) start.setMinutes(start.getMinutes() - 1);
  const { date, time } = zurichStamp(start);
  lessonId = `${date}_${time}_${COURSE}`;

  const { error: lessonError } = await takt.from('lessons').insert({
    id: lessonId,
    teacher_id: teacherId,
    course_id: COURSE,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 45 * 60_000).toISOString(),
    // The teacher opened the exit ticket a moment ago.
    exit_opened_at: new Date(Date.now() - 60_000).toISOString(),
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
      topic: TOPIC, goals: GOALS, standing: [], homework: '', blocks: [],
    },
  });
  if (planError) throw planError;
});

test.afterAll(async () => {
  if (!lessonId) return;
  // The ticket and the note go with the lesson.
  await takt.from('plans').delete().eq('teacher_id', teacherId).eq('id', lessonId);
  await takt.from('lessons').delete().eq('teacher_id', teacherId).eq('id', lessonId);
});

async function signIn(page: Page, email: string) {
  await page.goto('/');
  await page.getByLabel('E-Mail').fill(email);
  await page.getByLabel('Passwort').fill(PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOPIC);
}

const exitTicket = (page: Page) => page.getByRole('region', { name: 'Exit-Ticket' });
const rating = (page: Page, goal: string, name: string) =>
  exitTicket(page).getByRole('group', { name: goal }).getByRole('radio', { name, exact: true });

async function storedTicket() {
  const { data, error } = await student
    .from('exit_tickets')
    .select('unclear, ratings, submitted_at')
    .eq('teacher_id', teacherId)
    .eq('lesson_id', lessonId)
    .eq('student_id', LEA_ROSTER)
    .single();
  if (error) throw error;
  return data;
}

test('Lea reads who sees what, hands in, and sees her answers again', async ({ page }) => {
  await signIn(page, 'lea@seed.test');
  const ticket = exitTicket(page);
  await expect(ticket).toBeVisible();
  await expect(ticket).toContainText(`«Was war unklar?» geht mit deinem Namen an ${teacherName}.`);
  await expect(ticket).toContainText('«Was haben wir gemacht?» siehst nur du.');
  await expect(ticket).toContainText('Wenn du anwesend bist, zählt das Abgeben für die mündliche Note.');

  // Nothing unclear and no "Alles klar": refused before it is sent.
  await ticket.getByRole('button', { name: 'Abgeben' }).click();
  await expect(ticket.getByRole('alert')).toHaveText('Schreib, was unklar war, oder wähle «Alles klar».');

  await ticket.getByLabel('Was haben wir gemacht?').fill(NOTE);
  await ticket.getByLabel('Was war unklar?').fill(UNCLEAR);
  await rating(page, GOALS[0], '3').check();
  await ticket.getByRole('button', { name: 'Abgeben' }).click();
  await expect(ticket.getByRole('status')).toHaveText(/^Abgegeben \d\d:\d\d · du kannst bis \d\d:\d\d ändern$/);
  await expect(ticket.getByRole('alert')).toHaveCount(0);

  // Read back from the server, not just the form's own state.
  await page.reload();
  await expect(exitTicket(page).getByLabel('Was haben wir gemacht?')).toHaveValue(NOTE);
  await expect(exitTicket(page).getByLabel('Was war unklar?')).toHaveValue(UNCLEAR);
  await expect(rating(page, GOALS[0], '3')).toBeChecked();
  await expect(rating(page, GOALS[1], 'Keine Angabe')).toBeChecked();
  await expect(exitTicket(page).getByRole('status')).toHaveText(/^Abgegeben \d\d:\d\d/);

  const stored = await storedTicket();
  expect(stored.unclear).toBe(UNCLEAR);
  expect(stored.ratings).toEqual({ [GOALS[0]]: 3 });
});

test('Lea edits her ticket with "Alles klar", and the first submission time stays', async ({ page }) => {
  const first = (await storedTicket()).submitted_at;
  await signIn(page, 'lea@seed.test');
  const ticket = exitTicket(page);
  const handedIn = await ticket.getByRole('status').textContent();

  await ticket.getByLabel('Alles klar').check();
  await expect(ticket.getByLabel('Was war unklar?')).toBeDisabled();
  await rating(page, GOALS[0], 'Keine Angabe').check();
  await rating(page, GOALS[1], '4').check();
  await ticket.getByRole('button', { name: 'Abgeben' }).click();
  await expect(ticket.getByRole('status')).toHaveText(handedIn!);

  await page.reload();
  await expect(exitTicket(page).getByLabel('Alles klar')).toBeChecked();
  await expect(exitTicket(page).getByLabel('Was haben wir gemacht?')).toHaveValue(NOTE);
  await expect(rating(page, GOALS[0], 'Keine Angabe')).toBeChecked();
  await expect(rating(page, GOALS[1], '4')).toBeChecked();

  const stored = await storedTicket();
  expect(stored.unclear).toBe('Alles klar');
  expect(stored.ratings).toEqual({ [GOALS[1]]: 4 });
  expect(stored.submitted_at).toBe(first);
});

test('once the ticket has closed, Lea is told so and sees what she handed in', async ({ page }) => {
  // The device's clock, an hour on: the lesson ended and its ticket closed.
  await page.clock.install();
  await signIn(page, 'lea@seed.test');
  await expect(exitTicket(page).getByRole('button', { name: 'Abgeben' })).toBeVisible();
  await page.clock.fastForward('01:00:00');

  const ticket = exitTicket(page);
  await expect(ticket.getByRole('status')).toHaveText(/^Das Exit-Ticket ist seit \d\d:\d\d geschlossen\. Abgegeben \d\d:\d\d\.$/);
  await expect(ticket.getByRole('button', { name: 'Abgeben' })).toHaveCount(0);
  await expect(ticket).toContainText(NOTE);
  await expect(ticket).toContainText('Alles klar');
  await expect(ticket.getByText('4 von 4')).toBeVisible();
});
