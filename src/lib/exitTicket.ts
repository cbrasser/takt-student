/**
 * The exit ticket: whether it is open for a lesson, what the form holds, what
 * it sends and what a refusal says. Pure, so it is tested without a database
 * or a clock. The device's clock only decides what to show; the server
 * decides whether a hand-in counts, and stamps its time.
 */
import { formatTime } from './format.ts';
import { exitClosesAt, exitOpensAt, isExitOpen, type Lesson } from './lessons.ts';

/** The answer to "Was war unklar?" when nothing was. */
export const ALLES_KLAR = 'Alles klar';

/** The student's own exit ticket, both parts, as the server keeps it. */
export interface ExitTicket {
  teacherId: string;
  lessonId: string;
  /** "Was haben wir gemacht?": only the student reads it. */
  note: string;
  /** "Was war unklar?"; empty while nothing is handed in. */
  unclear: string;
  /** Goal text, as shown when handed in, to 1–4. */
  ratings: Record<string, number>;
  /** The server's time of the first "Abgeben"; null when nothing is handed in. */
  submittedAt: Date | null;
}

export type ExitTicketState =
  /** Not open yet: nothing to show. */
  | { kind: 'not-open' }
  /** The form, to hand in or edit until `closesAt`. */
  | { kind: 'open'; closesAt: Date; handedInAt: Date | null }
  | { kind: 'closed'; closedAt: Date; handedInAt: Date | null };

export function exitTicketState(lesson: Lesson, ticket: ExitTicket | undefined, now: Date): ExitTicketState {
  const handedInAt = ticket?.submittedAt ?? null;
  if (isExitOpen(lesson, now)) return { kind: 'open', closesAt: exitClosesAt(lesson), handedInAt };
  if (now.getTime() < exitOpensAt(lesson).getTime()) return { kind: 'not-open' };
  return { kind: 'closed', closedAt: exitClosesAt(lesson), handedInAt };
}

/** What the form holds. "Alles klar" is a choice next to the text, not text. */
export interface Draft {
  note: string;
  unclear: string;
  allesKlar: boolean;
  /** Only the goals the student rated. */
  ratings: Record<string, number>;
}

/** What `takt_student.submit_exit_ticket()` takes. */
export interface Submission {
  note: string;
  unclear: string;
  ratings: Record<string, number>;
}

const BLANK = 'Schreib, was unklar war, oder wähle «Alles klar».';

/** Only ratings of the lesson's goals: one the teacher has since changed is dropped. */
function ratingsFor(ratings: Record<string, number>, goals: string[]): Record<string, number> {
  return Object.fromEntries(goals.flatMap((g) => (Number.isInteger(ratings[g]) && ratings[g] >= 1 && ratings[g] <= 4 ? [[g, ratings[g]]] : [])));
}

/** The form for a lesson: empty, or what the student handed in. */
export function draftOf(ticket: ExitTicket | undefined, goals: string[]): Draft {
  const allesKlar = ticket?.unclear === ALLES_KLAR;
  return {
    note: ticket?.note ?? '',
    unclear: allesKlar ? '' : (ticket?.unclear ?? ''),
    allesKlar,
    ratings: ratingsFor(ticket?.ratings ?? {}, goals),
  };
}

/** What "Abgeben" sends, or why it can't yet. */
export function submissionOf(draft: Draft, goals: string[]): { submission: Submission } | { problem: string } {
  const unclear = draft.allesKlar ? ALLES_KLAR : draft.unclear.trim();
  if (!unclear) return { problem: BLANK };
  return { submission: { note: draft.note, unclear, ratings: ratingsFor(draft.ratings, goals) } };
}

/** Why the server refused, from the reason `takt_student.submit_exit_ticket()` raises. */
export function exitRefusal(reason: string | undefined, lesson: Lesson): string {
  switch (reason) {
    case 'exit_ticket_not_open':
      return `Das Exit-Ticket öffnet um ${formatTime(exitOpensAt(lesson))}.`;
    case 'exit_ticket_closed':
      return `Das Exit-Ticket ist seit ${formatTime(exitClosesAt(lesson))} geschlossen.`;
    case 'exit_ticket_not_enrolled':
      return 'Du bist nicht in diesem Kurs eingeschrieben.';
    case 'exit_ticket_unclear_blank':
      return BLANK;
    default:
      return 'Abgeben hat nicht geklappt. Bist du online?';
  }
}

/** "Abgegeben 08:52" */
export function handedInLabel(at: Date): string {
  return `Abgegeben ${formatTime(at)}`;
}

/** "Das Exit-Ticket ist seit 09:15 geschlossen. Abgegeben 08:52." */
export function closedLabel(closedAt: Date, handedInAt: Date | null): string {
  const handedIn = handedInAt ? `${handedInLabel(handedInAt)}.` : 'Du hast keines abgegeben.';
  return `Das Exit-Ticket ist seit ${formatTime(closedAt)} geschlossen. ${handedIn}`;
}
