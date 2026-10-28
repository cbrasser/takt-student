/**
 * An exit ticket's status, the client copy of cbra-platform's
 * `takt_student.ticket_status()` (and of Takt's `src/lib/ticketStatus.ts`):
 * only a present student (on time, late or present by hand) owes one, and
 * absence never counts. Handing in wins over the teacher's excuse. The shared
 * cases in tests/fixtures/exit_ticket_status_cases.json pin it to the
 * database's.
 */
import type { CheckInStatus } from './checkin.ts';

export type TicketStatus = 'not_required' | 'handed_in' | 'excused' | 'missing';

/**
 * A ticket's state before the check-in is asked: handed in, excused, or
 * neither (no row, or an excuse taken back). cbra-platform's
 * `takt_student.ticket_kind()`.
 */
export type TicketKind = 'handed_in' | 'excused' | 'none';

export const ticketKind = (submitted: boolean, excused: boolean): TicketKind => (submitted ? 'handed_in' : excused ? 'excused' : 'none');

/** The ticket status of a student with this check-in status and ticket state (undefined: no row). */
export function ticketStatus(status: CheckInStatus, kind: TicketKind | undefined): TicketStatus {
  if (status !== 'on_time' && status !== 'late' && status !== 'present') return 'not_required';
  return kind === 'handed_in' || kind === 'excused' ? kind : 'missing';
}
