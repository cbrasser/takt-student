import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attendanceLabel, courseHistory, exportName, historyMarkdown, ticketMark } from '../src/lib/history.ts';
import type { CheckIn } from '../src/lib/checkin.ts';
import type { ExitTicket } from '../src/lib/exitTicket.ts';
import type { Course, Lesson } from '../src/lib/lessons.ts';

const MIN = 60_000;

// Check-in started before every lesson below, unless a test says otherwise.
const course: Course = { teacherId: 'anna', id: 'inf', name: '3a · Informatik', teacherName: 'Anna Muster', siteUrl: null, checkInStart: '2026-11-01', semesters: [] };

/** A lesson of the course, 08:15–09:00 Zurich time on the given November day. */
function lesson(day: number, extra: Partial<Lesson> = {}): Lesson {
  const d = String(day).padStart(2, '0');
  return {
    teacherId: 'anna',
    id: `2026-11-${d}_0815_inf`,
    courseId: 'inf',
    startsAt: new Date(`2026-11-${d}T08:15:00+01:00`),
    endsAt: new Date(`2026-11-${d}T09:00:00+01:00`),
    exitOpenedAt: null,
    title: 'INF',
    topic: `Thema ${day}`,
    goals: [],
    standing: [],
    homework: '',
    materials: [],
    review: null,
    ...extra,
  };
}

function checkIn(l: Lesson, status: CheckIn['status']): CheckIn {
  return { teacherId: l.teacherId, lessonId: l.id, checkedInAt: status === 'present' || status === 'excused' ? null : l.startsAt, status };
}

function ticket(l: Lesson, extra: Partial<ExitTicket> = {}): ExitTicket {
  return {
    teacherId: l.teacherId,
    lessonId: l.id,
    note: 'Wir haben XOR geübt.',
    unclear: 'Alles klar',
    ratings: {},
    submittedAt: new Date(l.endsAt.getTime() - 5 * MIN),
    excused: false,
    ...extra,
  };
}

test('Verlauf: the course\'s lessons that have ended, newest first', () => {
  const first = lesson(2);
  const second = lesson(4);
  const running = lesson(9);
  const later = lesson(11);
  const otherCourse = lesson(3, { id: '2026-11-03_0815_mat', courseId: 'mat' });
  const otherTeacher = lesson(5, { teacherId: 'ben' });
  const now = new Date('2026-11-09T08:30:00+01:00');

  const history = courseHistory([later, second, otherCourse, running, first, otherTeacher], course, [], [], now);

  assert.deepEqual(history.map((e) => e.lesson.id), [second.id, first.id]);
});

test('her status per lesson: pünktlich, zu spät, entschuldigt, anwesend, or verpasst without a check-in', () => {
  const now = new Date('2026-11-30T12:00:00+01:00');
  const cases: [CheckIn['status'] | 'no row', string, string][] = [
    ['on_time', 'on_time', 'pünktlich'],
    ['late', 'late', 'zu spät'],
    ['excused', 'excused', 'entschuldigt'],
    // The teacher marked her present by hand afterwards.
    ['present', 'present', 'anwesend'],
    // A row of the teacher's without a check-in (a mark taken back).
    ['missing', 'missed', 'verpasst'],
    ['no row', 'missed', 'verpasst'],
    // A status this app doesn't know reads as no check-in.
    [null, 'missed', 'verpasst'],
  ];
  for (const [status, attendance, label] of cases) {
    const l = lesson(2);
    const [entry] = courseHistory([l], course, status === 'no row' ? [] : [checkIn(l, status)], [], now);
    assert.equal(entry.attendance, attendance, String(status));
    assert.equal(attendanceLabel(entry.attendance), label, String(status));
  }
});

test('each lesson gets its own check-in, not one of another lesson or teacher', () => {
  const mine = lesson(2);
  const other = lesson(4);
  const bens = lesson(2, { teacherId: 'ben' });
  const now = new Date('2026-11-30T12:00:00+01:00');
  const history = courseHistory([mine, other], course, [checkIn(other, 'late'), checkIn(bens, 'on_time')], [], now);
  assert.deepEqual(history.map((e) => e.attendance), ['late', 'missed']);
});

/**
 * cbra-platform's supabase/tests/exit_ticket_status_cases.json, which its psql
 * suite asserts against takt_student.ticket_status(): the teacher's count of
 * "Exit-Ticket fehlt" and the student's Verlauf agree.
 */
const CASES_FILE = new URL('./fixtures/exit_ticket_status_cases.json', import.meta.url);
const CASES: {
  case: string;
  check_in: 'on_time' | 'late' | 'present' | 'excused' | 'missing';
  ticket: { submitted: boolean; excused: boolean } | null;
  status: string;
}[] = JSON.parse(readFileSync(CASES_FILE, 'utf8'));

test('the ticket status of a closed lesson follows the shared cases', () => {
  const l = lesson(2);
  const now = new Date('2026-11-02T09:15:00+01:00');
  for (const c of CASES) {
    const t = c.ticket && ticket(l, c.ticket.submitted ? { excused: c.ticket.excused } : { unclear: '', submittedAt: null, excused: c.ticket.excused });
    const [entry] = courseHistory([l], course, [checkIn(l, c.check_in)], t ? [t] : [], now);
    assert.equal(entry.ticket, c.status, c.case);
  }
});

test('without a check-in row, no ticket is owed', () => {
  const l = lesson(2);
  const [entry] = courseHistory([l], course, [], [], new Date('2026-11-30T12:00:00+01:00'));
  assert.equal(entry.ticket, 'not_required');
});

// The platform checkout next to this one ($CBRA_PLATFORM_DIR, else ../cbra-platform).
const platformCases = join(process.env.CBRA_PLATFORM_DIR ?? fileURLToPath(new URL('../../cbra-platform', import.meta.url)), 'supabase/tests/exit_ticket_status_cases.json');

test('the shared cases are a copy of cbra-platform\'s', { skip: !existsSync(platformCases) && 'no cbra-platform checkout' }, () => {
  assert.equal(readFileSync(CASES_FILE, 'utf8'), readFileSync(platformCases, 'utf8'));
});

test('a present student\'s missing ticket is "open", not missing, until the ticket closes 15 minutes after the end', () => {
  const l = lesson(2);
  const closes = new Date('2026-11-02T09:15:00+01:00').getTime();
  const [open] = courseHistory([l], course, [checkIn(l, 'on_time')], [], new Date(closes - 1));
  assert.equal(open.ticket, 'open');
  const [closed] = courseHistory([l], course, [checkIn(l, 'on_time')], [], new Date(closes));
  assert.equal(closed.ticket, 'missing');
  // Handed in or excused reads the same while open.
  const [handedIn] = courseHistory([l], course, [checkIn(l, 'late')], [ticket(l)], new Date(closes - 1));
  assert.equal(handedIn.ticket, 'handed_in');
});

test('her own ticket shows wherever she handed one in, owed or not; an excuse alone is not one', () => {
  const absent = lesson(2);
  const excused = lesson(4);
  const now = new Date('2026-11-30T12:00:00+01:00');
  const mine = ticket(absent, { note: 'Nachgelesen.' });
  const history = courseHistory(
    [absent, excused],
    course,
    [checkIn(excused, 'on_time')],
    [mine, ticket(excused, { unclear: '', submittedAt: null, excused: true })],
    now,
  );
  assert.deepEqual(
    history.map((e) => [e.lesson.id, e.ticket, e.handedIn]),
    [
      [excused.id, 'excused', null],
      [absent.id, 'not_required', mine],
    ],
  );
});

test('what the Verlauf says about the ticket', () => {
  const l = lesson(2);
  const on = (checkInStatus: CheckIn['status'], tickets: ExitTicket[], now: string) =>
    ticketMark(courseHistory([l], course, [checkIn(l, checkInStatus)], tickets, new Date(now))[0]);
  const after = '2026-11-30T12:00:00+01:00';
  assert.deepEqual(on('on_time', [], after), { label: 'Exit-Ticket fehlt', missing: true });
  assert.deepEqual(on('on_time', [ticket(l, { unclear: '', submittedAt: null, excused: true })], after), { label: 'Exit-Ticket entschuldigt', missing: false });
  assert.deepEqual(on('on_time', [], '2026-11-02T09:05:00+01:00'), { label: 'Exit-Ticket offen bis 09:15', missing: false });
  assert.deepEqual(on('late', [ticket(l)], after), { label: 'Abgegeben 08:55', missing: false });
  // Handed in while absent: still her ticket.
  assert.deepEqual(on('missing', [ticket(l)], after), { label: 'Abgegeben 08:55', missing: false });
  // Not required and nothing handed in: nothing is said.
  assert.equal(on('excused', [], after), null);
});

test('the Markdown export: her lessons oldest first, with her status, her notes and her tickets', () => {
  const xor = lesson(2, { topic: 'XOR', homework: 'Blatt 3,\nAufgaben 1–4' });
  const missed = lesson(4, { topic: '' });
  const noTicket = lesson(9, { topic: 'One-Time-Pad' });
  const now = new Date('2026-11-30T12:00:00+01:00');
  const history = courseHistory(
    [xor, missed, noTicket],
    course,
    [checkIn(xor, 'on_time'), checkIn(noTicket, 'late')],
    [
      ticket(xor, {
        note: 'Wir haben XOR geübt.\n# Keine Überschrift',
        unclear: 'Warum ist der Schlüssel so lang?',
        ratings: { 'Ich kann XOR anwenden.': 3 },
      }),
    ],
    now,
  );

  assert.equal(
    historyMarkdown(course, history),
    [
      '# 3a · Informatik',
      '',
      'Dein Verlauf aus Takt: deine Lektionen, dein Status, deine Notizen und Exit-Tickets.',
      '',
      '## Montag, 2. November 2026 · XOR',
      '',
      '08:15–09:00 · pünktlich · Abgegeben 08:55',
      '',
      '### Was haben wir gemacht?',
      '',
      '> Wir haben XOR geübt.',
      '> # Keine Überschrift',
      '',
      '### Was war unklar?',
      '',
      '> Warum ist der Schlüssel so lang?',
      '',
      '### Wie sicher du bei den Zielen warst',
      '',
      '- Ich kann XOR anwenden. – 3 von 4',
      '',
      '### Hausaufgaben',
      '',
      '> Blatt 3,',
      '> Aufgaben 1–4',
      '',
      '## Mittwoch, 4. November 2026 · Noch kein Thema',
      '',
      '08:15–09:00 · verpasst',
      '',
      '## Montag, 9. November 2026 · One-Time-Pad',
      '',
      '08:15–09:00 · zu spät · Exit-Ticket fehlt',
      '',
    ].join('\n'),
  );
});

test('the export of a course without past lessons says so', () => {
  assert.equal(
    historyMarkdown(course, []),
    '# 3a · Informatik\n\nDein Verlauf aus Takt: deine Lektionen, dein Status, deine Notizen und Exit-Tickets.\n\nNoch keine vergangenen Lektionen.\n',
  );
});

test('the export is named after the course, safe as a file name', () => {
  assert.equal(exportName(course), 'Verlauf 3a · Informatik.md');
  assert.equal(exportName({ ...course, name: 'BG/MA: "Mathe"?' }), 'Verlauf BG-MA- -Mathe--.md');
});

test('before the course\'s check-in start a lesson has no status: not "verpasst", no ticket owed', () => {
  const backfilled = lesson(2);
  const startDay = lesson(4);
  const after = lesson(9);
  const now = new Date('2026-11-30T12:00:00+01:00');
  // Check-in started with a mark on 4 November.
  const started = { ...course, checkInStart: '2026-11-04' };
  const history = courseHistory([backfilled, startDay, after], started, [checkIn(startDay, 'present')], [], now);
  assert.deepEqual(
    history.map((e) => [e.lesson.id, e.attendance, e.ticket, ticketMark(e)]),
    [
      [after.id, 'missed', 'not_required', null],
      [startDay.id, 'present', 'missing', { label: 'Exit-Ticket fehlt', missing: true }],
      [backfilled.id, null, 'not_required', null],
    ],
  );
});

test('before the start, her own ticket still shows', () => {
  const backfilled = lesson(2);
  const mine = ticket(backfilled);
  const [entry] = courseHistory([backfilled], { ...course, checkInStart: '2026-11-04' }, [], [mine], new Date('2026-11-30T12:00:00+01:00'));
  assert.equal(entry.attendance, null);
  assert.equal(entry.handedIn, mine);
  assert.deepEqual(ticketMark(entry), { label: 'Abgegeben 08:55', missing: false });
});

test('a course without check-ins has no status anywhere', () => {
  const l = lesson(2);
  const [entry] = courseHistory([l], { ...course, checkInStart: null, semesters: [] }, [], [], new Date('2026-11-30T12:00:00+01:00'));
  assert.equal(entry.attendance, null);
  assert.equal(entry.ticket, 'not_required');
});

test('the start is the lesson\'s day in Zurich: 00:30 on 4 November is on it, though still 3 November in UTC', () => {
  const night = lesson(4, { startsAt: new Date('2026-11-04T00:30:00+01:00'), endsAt: new Date('2026-11-04T01:15:00+01:00') });
  const [entry] = courseHistory([night], { ...course, checkInStart: '2026-11-04' }, [], [], new Date('2026-11-30T12:00:00+01:00'));
  assert.equal(entry.attendance, 'missed');
});

test('the export says no status before the start', () => {
  const backfilled = lesson(2, { topic: 'Caesar' });
  const history = courseHistory([backfilled], { ...course, checkInStart: '2026-11-04' }, [], [], new Date('2026-11-30T12:00:00+01:00'));
  assert.match(historyMarkdown(course, history), /## Montag, 2\. November 2026 · Caesar\n\n08:15–09:00\n/);
});
