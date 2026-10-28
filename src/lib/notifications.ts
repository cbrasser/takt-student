/**
 * The "Exit-Ticket ist offen" notification of the desktop app: its switch and
 * the lessons already seen open, both in the app's own storage, and the OS
 * notification itself. Which lessons it fires for is decided in
 * `exitNotice.ts`.
 */
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

const SWITCH_KEY = 'takt-student.exit-notice';
const seenKey = (userId: string) => `takt-student.exit-notice-seen.${userId}`;

/** On unless the student switched it off. */
export function exitNoticeOn(): boolean {
  try {
    return localStorage.getItem(SWITCH_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setExitNoticeOn(on: boolean) {
  try {
    if (on) localStorage.removeItem(SWITCH_KEY);
    else localStorage.setItem(SWITCH_KEY, 'off');
  } catch {
    // Storage blocked: the switch lasts until the app closes.
  }
}

/** The `lessonKey`s this student's app has seen open, so a restart doesn't notify again. */
export function seenOpen(userId: string): string[] {
  try {
    const seen: unknown = JSON.parse(localStorage.getItem(seenKey(userId)) ?? '[]');
    return Array.isArray(seen) ? seen.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export function keepSeenOpen(userId: string, seen: string[]) {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify(seen));
  } catch {
    // Storage blocked: a restart may notify once more.
  }
}

/** Shows an OS notification; the OS asks for permission the first time. */
export async function notify(notice: { title: string; body: string }) {
  try {
    const granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
    if (granted) sendNotification(notice);
  } catch {
    // No notifications on this system: the lesson view still shows the ticket.
  }
}
