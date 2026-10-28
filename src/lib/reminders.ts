/**
 * Reminders of Prüfungen and Abgaben in the desktop app: which are due on a
 * poll, from the assessments, the reminders already sent, the switches and
 * the time. "in 7 Tagen" and "morgen" for every assessment, "Abgabe heute"
 * on an Abgabe's deadline day, each on the first poll from 07:00 that day.
 * Pure, so it is tested without a database, a clock or the OS.
 */
import { assessmentKey, kindLabel, type Assessment } from './assessments.ts';
import type { Notice } from './exitNotice.ts';
import { addDays, formatDay, formatTime, hourOf, isoDay } from './format.ts';
import type { Course } from './lessons.ts';

/** "in 7 Tagen", "morgen", "Abgabe heute". */
export const REMINDER_KINDS = ['week', 'tomorrow', 'today'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Each type of reminder has its own switch in Settings. */
export type ReminderSwitches = Record<ReminderKind, boolean>;

export interface Reminder {
  kind: ReminderKind;
  assessment: Assessment;
}

export interface Reminders {
  /** The reminders to send now. */
  due: Reminder[];
  /** The keys of the reminders sent, to pass to the next poll: only those that could still fire. */
  sent: string[];
}

/** No reminder before this hour of the day, on the Swiss clock. */
export const FROM_HOUR = 7;

/** Per type: how many days before the day it's about it fires, and what the notice says of when. */
const RULES: Record<ReminderKind, { daysBefore: number; when: string }> = {
  week: { daysBefore: 7, when: 'in 7 Tagen' },
  tomorrow: { daysBefore: 1, when: 'morgen' },
  today: { daysBefore: 0, when: 'heute' },
};

/**
 * The day a reminder is about: the assessment's date, or for "Abgabe heute"
 * its deadline's day (its date without a deadline). It goes into the key, so
 * moving the assessment re-arms the reminder, and a new title doesn't.
 */
function aboutDay(kind: ReminderKind, a: Assessment): string {
  return kind === 'today' && a.deadline ? isoDay(a.deadline) : a.date;
}

/** The day a reminder fires on. */
const firesOn = (kind: ReminderKind, a: Assessment) => addDays(aboutDay(kind, a), -RULES[kind].daysBefore);

/** "Abgabe heute" is an Abgabe's, until its deadline. */
const applies = (kind: ReminderKind, a: Assessment, now: Date) =>
  kind !== 'today' || (a.kind === 'hand-in' && (a.deadline === null || a.deadline.getTime() > now.getTime()));

/** "tomorrow anna/seed-assessment-test 2026-11-16" */
const keyOf = (kind: ReminderKind, a: Assessment) => `${kind} ${assessmentKey(a)} ${aboutDay(kind, a)}`;

/** The day a key is about: once it is past, the key can't fire again. */
const keyDay = (key: string) => key.slice(key.lastIndexOf(' ') + 1);

export function reminders(assessments: Assessment[], sent: string[], switches: ReminderSwitches, now: Date): Reminders {
  const today = isoDay(now);
  const due: Reminder[] = [];
  if (hourOf(now) >= FROM_HOUR) {
    for (const assessment of assessments) {
      for (const kind of REMINDER_KINDS) {
        if (switches[kind] && firesOn(kind, assessment) === today && applies(kind, assessment, now) && !sent.includes(keyOf(kind, assessment))) {
          due.push({ kind, assessment });
        }
      }
    }
  }
  return {
    due,
    sent: [...sent.filter((k) => keyDay(k) >= today), ...due.map((r) => keyOf(r.kind, r.assessment))],
  };
}

/**
 * The deadline as the notice says it: "bis 18:00" on the day the reminder is
 * about, else with its own day, "bis Freitag, 20. November, 18:00".
 */
function until(r: Reminder): string | null {
  const d = r.assessment.deadline;
  if (!d) return null;
  return isoDay(d) === aboutDay(r.kind, r.assessment) ? `bis ${formatTime(d)}` : `bis ${formatDay(d)}, ${formatTime(d)}`;
}

/** "Prüfung in 7 Tagen" / "3a · Informatik · Prüfung Kryptologie", and an Abgabe's deadline: "· bis 18:00". */
export function reminderNotice(r: Reminder, course: Course | undefined): Notice {
  const a = r.assessment;
  const parts = [course?.name, a.title, until(r)];
  return {
    title: `${kindLabel(a.kind)} ${RULES[r.kind].when}`,
    body: parts.filter(Boolean).join(' · '),
  };
}
