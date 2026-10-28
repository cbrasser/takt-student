/**
 * The desktop app's notifications: "Exit-Ticket ist offen" and the reminders
 * of Prüfungen and Abgaben. Their switches and what was already sent live in
 * the app's own storage; this sends the OS notification itself. Which lessons
 * and assessments they fire for is decided in `exitNotice.ts` and
 * `reminders.ts`.
 */
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import type { Notice } from './exitNotice';
import type { ReminderKind } from './reminders';

/** One switch each in Settings. */
export type NoticeType = 'exit' | ReminderKind;
export type NoticeSwitches = Record<NoticeType, boolean>;

const SWITCH_KEYS: Record<NoticeType, string> = {
  exit: 'takt-student.exit-notice',
  week: 'takt-student.reminder-week',
  tomorrow: 'takt-student.reminder-tomorrow',
  today: 'takt-student.reminder-today',
};

/** Each on unless the student switched it off. */
export function noticeSwitches(): NoticeSwitches {
  const on = (type: NoticeType) => {
    try {
      return localStorage.getItem(SWITCH_KEYS[type]) !== 'off';
    } catch {
      return true;
    }
  };
  return { exit: on('exit'), week: on('week'), tomorrow: on('tomorrow'), today: on('today') };
}

export function setNoticeOn(type: NoticeType, on: boolean) {
  try {
    if (on) localStorage.removeItem(SWITCH_KEYS[type]);
    else localStorage.setItem(SWITCH_KEYS[type], 'off');
  } catch {
    // Storage blocked: the switch lasts until the app closes.
  }
}

/** What this student's app already noticed, so a restart doesn't notify again. */
function keys(storageKey: string): string[] {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(kept) ? kept.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

function keep(storageKey: string, kept: string[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(kept));
  } catch {
    // Storage blocked: a restart may notify once more.
  }
}

const seenKey = (userId: string) => `takt-student.exit-notice-seen.${userId}`;
const sentKey = (userId: string) => `takt-student.reminders-sent.${userId}`;

/** The `lessonKey`s this student's app has seen open. */
export const seenOpen = (userId: string) => keys(seenKey(userId));
export const keepSeenOpen = (userId: string, seen: string[]) => keep(seenKey(userId), seen);

/** The reminders this student's app has sent (`reminders()`'s keys). */
export const sentReminders = (userId: string) => keys(sentKey(userId));
export const keepSentReminders = (userId: string, sent: string[]) => keep(sentKey(userId), sent);

/** Shows an OS notification; the OS asks for permission the first time. */
export async function notify(notice: Notice) {
  try {
    const granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
    if (granted) sendNotification(notice);
  } catch {
    // No notifications on this system: the app still shows what they say.
  }
}
