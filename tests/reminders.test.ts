import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderNotice, reminders, type ReminderSwitches } from '../src/lib/reminders.ts';
import type { Assessment } from '../src/lib/assessments.ts';
import type { Course } from '../src/lib/lessons.ts';

const ALL_ON: ReminderSwitches = { week: true, tomorrow: true, today: true };

function assessment(id: string, date: string, extra: Partial<Assessment> = {}): Assessment {
  return {
    teacherId: 'anna',
    id,
    courseId: 'inf',
    date,
    kind: 'test',
    title: `Titel ${id}`,
    deadline: null,
    pages: [],
    goals: [],
    practiceUrl: '',
    freeText: '',
    ...extra,
  };
}

/** Zurich time on the given day (UTC+1 in November). */
const at = (day: string, time: string) => new Date(`${day}T${time}:00+01:00`);

/** "kind id" of each reminder due. */
const dueOf = (r: ReturnType<typeof reminders>) => r.due.map((d) => `${d.kind} ${d.assessment.id}`);

// A Prüfung on Monday 16 November, and an Abgabe due Friday 13 November at 18:00.
const pruefung = assessment('pruefung', '2026-11-16');
const abgabe = assessment('abgabe', '2026-11-13', { kind: 'hand-in', deadline: at('2026-11-13', '18:00') });

test('"in 7 Tagen" seven days before, "morgen" the day before, "Abgabe heute" on the deadline day', () => {
  assert.deepEqual(dueOf(reminders([pruefung, abgabe], [], ALL_ON, at('2026-11-06', '07:00'))), ['week abgabe']);
  assert.deepEqual(dueOf(reminders([pruefung, abgabe], [], ALL_ON, at('2026-11-09', '07:30'))), ['week pruefung']);
  assert.deepEqual(dueOf(reminders([pruefung, abgabe], [], ALL_ON, at('2026-11-12', '12:00'))), ['tomorrow abgabe']);
  assert.deepEqual(dueOf(reminders([pruefung, abgabe], [], ALL_ON, at('2026-11-13', '07:05'))), ['today abgabe']);
  assert.deepEqual(dueOf(reminders([pruefung, abgabe], [], ALL_ON, at('2026-11-15', '20:00'))), ['tomorrow pruefung']);
  // Other days: nothing.
  assert.deepEqual(dueOf(reminders([pruefung, abgabe], [], ALL_ON, at('2026-11-10', '09:00'))), []);
});

test('before 07:00 nothing is due; the first poll from 07:00 that day sends it', () => {
  assert.deepEqual(dueOf(reminders([pruefung], [], ALL_ON, at('2026-11-15', '06:59'))), []);
  assert.deepEqual(dueOf(reminders([pruefung], [], ALL_ON, at('2026-11-15', '07:00'))), ['tomorrow pruefung']);
});

test('each fires once: what was sent is skipped on the next polls', () => {
  const first = reminders([pruefung], [], ALL_ON, at('2026-11-15', '07:00'));
  assert.deepEqual(dueOf(reminders([pruefung], first.sent, ALL_ON, at('2026-11-15', '07:01'))), []);
  assert.deepEqual(dueOf(reminders([pruefung], first.sent, ALL_ON, at('2026-11-15', '22:00'))), []);
});

test('a moved assessment is due again for its new date; a new title alone isn\'t', () => {
  const first = reminders([pruefung], [], ALL_ON, at('2026-11-09', '07:00'));
  const renamed = { ...pruefung, title: 'Neuer Titel' };
  assert.deepEqual(dueOf(reminders([renamed], first.sent, ALL_ON, at('2026-11-09', '08:00'))), []);
  // Moved from the 16th to the 17th: "in 7 Tagen" again on the 10th.
  const moved = { ...pruefung, date: '2026-11-17' };
  assert.deepEqual(dueOf(reminders([moved], first.sent, ALL_ON, at('2026-11-10', '07:00'))), ['week pruefung']);
});

test('an Abgabe\'s deadline moved re-arms "Abgabe heute"', () => {
  const first = reminders([abgabe], [], ALL_ON, at('2026-11-13', '07:00'));
  const later = { ...abgabe, deadline: at('2026-11-14', '12:00') };
  assert.deepEqual(dueOf(reminders([later], first.sent, ALL_ON, at('2026-11-14', '07:00'))), ['today abgabe']);
});

test('a switch that\'s off suppresses its type, and only that one', () => {
  const noWeek = { ...ALL_ON, week: false };
  assert.deepEqual(dueOf(reminders([pruefung, abgabe], [], noWeek, at('2026-11-09', '07:30'))), []);
  assert.deepEqual(dueOf(reminders([pruefung, abgabe], [], noWeek, at('2026-11-12', '07:30'))), ['tomorrow abgabe']);
  const noToday = { ...ALL_ON, today: false };
  assert.deepEqual(dueOf(reminders([abgabe], [], noToday, at('2026-11-13', '07:30'))), []);
  // Switched on again later that day, it catches up.
  assert.deepEqual(dueOf(reminders([abgabe], reminders([abgabe], [], noToday, at('2026-11-13', '07:30')).sent, ALL_ON, at('2026-11-13', '09:00'))), ['today abgabe']);
});

test('a Prüfung never gets "Abgabe heute"', () => {
  assert.deepEqual(dueOf(reminders([pruefung], [], ALL_ON, at('2026-11-16', '07:30'))), []);
});

test('"Abgabe heute" not after the deadline has passed; an Abgabe without a deadline is due on its date', () => {
  assert.deepEqual(dueOf(reminders([abgabe], [], ALL_ON, at('2026-11-13', '18:00'))), []);
  const noDeadline = assessment('ohne-frist', '2026-11-13', { kind: 'hand-in' });
  assert.deepEqual(dueOf(reminders([noDeadline], [], ALL_ON, at('2026-11-13', '08:00'))), ['today ohne-frist']);
});

test('the sent keys keep only what can still fire, so they don\'t grow forever', () => {
  const sent = reminders([pruefung], [], ALL_ON, at('2026-11-15', '07:00')).sent;
  assert.equal(sent.length, 1);
  assert.deepEqual(reminders([pruefung], sent, ALL_ON, at('2026-11-17', '07:00')).sent, []);
});

test('the notification names the kind, when, the course and the title', () => {
  const course: Course = { teacherId: 'anna', id: 'inf', name: '3a · Informatik', teacherName: null, siteUrl: null, checkInStart: null, semesters: [] };
  assert.deepEqual(reminderNotice({ kind: 'week', assessment: pruefung }, course), { title: 'Prüfung in 7 Tagen', body: '3a · Informatik · Titel pruefung' });
  assert.deepEqual(reminderNotice({ kind: 'tomorrow', assessment: abgabe }, course), { title: 'Abgabe morgen', body: '3a · Informatik · Titel abgabe · bis 18:00' });
  assert.deepEqual(reminderNotice({ kind: 'today', assessment: abgabe }, undefined), { title: 'Abgabe heute', body: 'Titel abgabe · bis 18:00' });
  assert.deepEqual(reminderNotice({ kind: 'tomorrow', assessment: { ...pruefung, title: '' } }, course), { title: 'Prüfung morgen', body: '3a · Informatik' });
});

test('an Abgabe due on another day than its date: the reminder names the deadline\'s day', () => {
  const later = assessment('spaeter', '2026-11-13', { kind: 'hand-in', title: 'Bericht', deadline: at('2026-11-20', '18:00') });
  assert.deepEqual(reminderNotice({ kind: 'tomorrow', assessment: later }, undefined), { title: 'Abgabe morgen', body: 'Bericht · bis Freitag, 20. November, 18:00' });
  assert.deepEqual(reminderNotice({ kind: 'today', assessment: later }, undefined), { title: 'Abgabe heute', body: 'Bericht · bis 18:00' });
});
