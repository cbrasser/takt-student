/**
 * The "Bereit" button: what it shows for a lesson, its check-in and the time,
 * and when the app re-reads. Pure, so it is tested without a database or a
 * clock. The device's clock only decides what to offer; the server decides
 * whether a check-in counts, and at what time.
 */
import { formatTime } from './format.ts';
import { isOpen, opensAt, type Lesson } from './lessons.ts';

/** As `takt_student.status()` gives it. */
export const STATUSES = ['on_time', 'late', 'excused', 'present', 'missing'] as const;
export type CheckInStatus = (typeof STATUSES)[number];

/** A status read from the server, or null for anything this app doesn't know. */
export function checkInStatus(s: string | null): CheckInStatus | null {
  return STATUSES.find((x) => x === s) ?? null;
}

export interface CheckIn {
  teacherId: string;
  lessonId: string;
  /** The server's time; null when the teacher only marked the student. */
  checkedInAt: Date | null;
  status: CheckInStatus | null;
}

export type CheckInState =
  /** The window isn't open and there's nothing to show. */
  | { kind: 'closed' }
  /** "Bereit" */
  | { kind: 'ready' }
  | { kind: 'checked-in'; at: Date; status: CheckInStatus | null };

/** How often the app re-reads while a check-in window is open, and otherwise. */
export const REFRESH_OPEN_MS = 60_000;
export const REFRESH_MS = 15 * 60_000;

/** The teacher's marks belong to the panel; here only the student's own check-in counts. */
export function checkInState(lesson: Lesson, checkIn: CheckIn | undefined, now: Date): CheckInState {
  if (checkIn?.checkedInAt) return { kind: 'checked-in', at: checkIn.checkedInAt, status: checkIn.status };
  return isOpen(lesson, now) ? { kind: 'ready' } : { kind: 'closed' };
}

const HOW: Partial<Record<CheckInStatus, string>> = { on_time: 'pünktlich', late: 'zu spät' };

/** "Eingecheckt 08:17 · pünktlich"; just the time when a mark of the teacher's decides. */
export function checkInLabel(at: Date, status: CheckInStatus | null): string {
  const how = status ? HOW[status] : undefined;
  return how ? `Eingecheckt ${formatTime(at)} · ${how}` : `Eingecheckt ${formatTime(at)}`;
}

/** Why the server refused a check-in, from the reason `takt_student.check_in()` raises. */
export function refusal(reason: string | undefined, lesson: Lesson): string {
  switch (reason) {
    case 'check_in_not_open':
      return `Check-in ist erst ab ${formatTime(opensAt(lesson))} möglich.`;
    case 'check_in_closed':
      return 'Die Lektion ist schon vorbei.';
    case 'check_in_not_enrolled':
      return 'Du bist nicht in diesem Kurs eingeschrieben.';
    default:
      return 'Einchecken hat nicht geklappt. Bist du online?';
  }
}

/** Every minute while any check-in window is open, every 15 minutes otherwise. */
export function refreshDue(lessons: Lesson[], loadedAt: Date | null, now: Date): boolean {
  if (!loadedAt) return true;
  const every = lessons.some((l) => isOpen(l, now)) ? REFRESH_OPEN_MS : REFRESH_MS;
  return now.getTime() - loadedAt.getTime() >= every;
}
