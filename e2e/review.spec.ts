// The anonymous review, end to end, against the local Supabase stack: Lea's
// lesson has a review and its exit ticket is open. Lea answers the review in
// the exit ticket's "Anonym" part, apart from the named ticket, sees only
// "Abgegeben", hands in the named ticket separately, and a second answer from
// a window opened before she answered is refused. Nothing on the device keeps
// what she wrote. Noah does it the other way round: the named ticket first,
// then the review.
//
// The test plants its own lesson, started a minute or two ago, in the seeded
// course INF-3a, with the review switched on in its plan, and opens its exit
// ticket as the teacher's early open does, by stamping `exit_opened_at`.
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.VITE_SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = 'devpassword';
const COURSE = 'seed-inf-3a';

const auth = { persistSession: false, autoRefreshToken: false };
const takt = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt' }, auth });
const student = createClient(URL_, SERVICE_KEY, { db: { schema: 'takt_student' }, auth });

const stamp = Date.now();
const TOPIC = `Passwörter ${stamp}`;
const PROMPTS = ['Was hat dir geholfen?', `Was war zu schnell? (${stamp})`];
const HELPED = `Das Beispiel mit dem Wörterbuchangriff (${stamp}).`;

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
  const { data: course, error } = await student.from('courses').select('teacher_id').eq('id', COURSE).single();
  if (error || !course) throw new Error(`the seed isn't loaded (pnpm db:reset in cbra-platform): ${error?.message}`);
  teacherId = course.teacher_id;

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
      topic: TOPIC, goals: [], standing: [], homework: '', blocks: [],
      review: { prompts: PROMPTS },
    },
  });
  if (planError) throw planError;
});

test.afterAll(async () => {
  if (!lessonId) return;
  // The review's two tables go with the lesson.
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
const anonym = (page: Page) => exitTicket(page).getByRole('region', { name: 'Anonym' });
const stars = (page: Page, n: string) =>
  anonym(page).getByRole('group', { name: /Wie war die Lektion für dich\?/ }).getByRole('radio', { name: n, exact: true });

/** What the teacher's count says, as Anna. */
async function teacherCount(): Promise<{ answered: number; enrolled: number }> {
  const anna = createClient(URL_, ANON_KEY, { db: { schema: 'takt_student' }, auth });
  const { error: signInError } = await anna.auth.signInWithPassword({ email: 'anna@seed.test', password: PASSWORD });
  if (signInError) throw signInError;
  const { data, error } = await anna.rpc('review_count', { lesson: lessonId }).single();
  if (error) throw error;
  return data as { answered: number; enrolled: number };
}

test('Lea answers the review and the exit ticket independently, sees "Abgegeben", and a second answer is refused', async ({ browser }) => {
  // A second window, open on the form before Lea answers in the first.
  const later = await (await browser.newContext()).newPage();
  await signIn(later, 'lea@seed.test');
  await expect(anonym(later).getByRole('button', { name: 'Anonym abgeben' })).toBeVisible();

  const page = await (await browser.newContext()).newPage();
  await signIn(page, 'lea@seed.test');
  const part = anonym(page);
  await expect(part).toContainText('Deine Lehrperson sieht nicht, wer das geschrieben hat.');
  await expect(part.getByLabel(PROMPTS[1])).toBeVisible();

  // No rating: refused before it is sent.
  await part.getByRole('button', { name: 'Anonym abgeben' }).click();
  await expect(part.getByRole('alert')).toHaveText('Wähle zuerst eine Bewertung von 1 bis 5.');

  await stars(page, '4').check();
  await part.getByLabel(PROMPTS[0]).fill(HELPED);
  await part.getByRole('button', { name: 'Anonym abgeben' }).click();
  await expect(part.getByRole('status')).toHaveText('Abgegeben');
  await expect(part.getByRole('button', { name: 'Anonym abgeben' })).toHaveCount(0);
  await expect(part).not.toContainText(HELPED);

  // The named ticket is untouched: still open, nothing handed in.
  const ticket = exitTicket(page);
  await expect(ticket.getByText(/^Offen bis \d\d:\d\d$/)).toBeVisible();
  expect(await teacherCount()).toEqual({ answered: 1, enrolled: 4 });

  // Handing in the named ticket leaves the anonymous part as it was.
  await ticket.getByLabel('Alles klar').check();
  await ticket.getByRole('button', { name: 'Abgeben', exact: true }).click();
  await expect(ticket.getByRole('status').filter({ hasText: /^Abgegeben \d\d:\d\d · du kannst/ })).toBeVisible();
  await expect(part.getByRole('status')).toHaveText('Abgegeben');

  // From the server after a restart, and nothing of the answer on the device.
  await page.reload();
  await expect(anonym(page).getByRole('status')).toHaveText('Abgegeben');
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain(HELPED);
  expect(stored).not.toContain('review');

  // The window opened before: its answer is refused, and it shows "Abgegeben".
  await stars(later, '1').check();
  await anonym(later).getByRole('button', { name: 'Anonym abgeben' }).click();
  await expect(anonym(later).getByRole('alert')).toHaveText('Du hast diese Bewertung schon abgegeben.');
  await expect(anonym(later).getByRole('status')).toHaveText('Abgegeben');
  expect(await teacherCount()).toEqual({ answered: 1, enrolled: 4 });

  // Not even the service role reads what was written.
  const { error } = await student.from('review_responses').select('rating');
  expect(error?.code).toBe('42501');
});

test('Noah hands in the exit ticket first, and answers the review after', async ({ page }) => {
  await signIn(page, 'noah@seed.test');
  const ticket = exitTicket(page);
  await ticket.getByLabel('Alles klar').check();
  await ticket.getByRole('button', { name: 'Abgeben', exact: true }).click();
  await expect(ticket.getByRole('status').filter({ hasText: /^Abgegeben \d\d:\d\d · du kannst/ })).toBeVisible();

  // Handing in answered nothing anonymous: the part is still open.
  const part = anonym(page);
  await expect(part.getByRole('button', { name: 'Anonym abgeben' })).toBeVisible();
  await stars(page, '3').check();
  await part.getByRole('button', { name: 'Anonym abgeben' }).click();
  await expect(part.getByRole('status')).toHaveText('Abgegeben');
  expect(await teacherCount()).toEqual({ answered: 2, enrolled: 4 });
});

test('a lesson without a review has no anonymous part', async ({ page }) => {
  await takt.from('plans').update({ doc: { topic: TOPIC, goals: [], standing: [], homework: '', blocks: [] } })
    .eq('teacher_id', teacherId).eq('id', lessonId);
  await signIn(page, 'lea@seed.test');
  await expect(exitTicket(page).getByRole('button', { name: 'Abgeben', exact: true })).toBeVisible();
  await expect(anonym(page)).toHaveCount(0);
});
