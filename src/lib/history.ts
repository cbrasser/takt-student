/**
 * The Verlauf: a course's past lessons with the student's own status and
 * exit ticket, and its Markdown export. Pure, so it is tested without a
 * database or a clock.
 */
import type { CheckIn } from './checkin.ts';
import { handedInLabel, type ExitTicket } from './exitTicket.ts';
import { formatDate, formatTime, formatTimes } from './format.ts';
import { courseKey, exitClosesAt, lessonKey, type Course, type Lesson } from './lessons.ts';
import { ticketKind, ticketStatus, type TicketStatus } from './ticketStatus.ts';

/**
 * The student's own status for a past lesson, from `takt_student.status()`:
 * checked in on time or late, excused, marked present by hand, or missed (no
 * check-in, not excused).
 */
export type Attendance = 'on_time' | 'late' | 'excused' | 'present' | 'missed';

const ATTENDANCE: Record<Attendance, string> = {
  on_time: 'pünktlich',
  late: 'zu spät',
  excused: 'entschuldigt',
  present: 'anwesend',
  missed: 'verpasst',
};

export function attendanceLabel(a: Attendance): string {
  return ATTENDANCE[a];
}

/**
 * The ticket's status as the teacher counts it, except that a missing ticket
 * is 'open' while it can still be handed in: the teacher counts a lesson only
 * once its ticket has closed.
 */
export type HistoryTicket = TicketStatus | 'open';

export interface HistoryEntry {
  lesson: Lesson;
  attendance: Attendance;
  ticket: HistoryTicket;
  /** What the student handed in, both parts, owed or not; null when nothing. */
  handedIn: ExitTicket | null;
}

function attendanceOf(checkIn: CheckIn | undefined): Attendance {
  const s = checkIn?.status;
  return s === 'on_time' || s === 'late' || s === 'excused' || s === 'present' ? s : 'missed';
}

/** The course's lessons that have ended by `now`, newest first. */
export function courseHistory(lessons: Lesson[], course: Course, checkIns: CheckIn[], tickets: ExitTicket[], now: Date): HistoryEntry[] {
  const key = courseKey(course);
  const checkInOf = new Map(checkIns.map((c) => [lessonKey({ teacherId: c.teacherId, id: c.lessonId }), c]));
  const ticketOf = new Map(tickets.map((t) => [lessonKey({ teacherId: t.teacherId, id: t.lessonId }), t]));
  return lessons
    .filter((l) => courseKey(l) === key && l.endsAt.getTime() <= now.getTime())
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .map((lesson): HistoryEntry => {
      const checkIn = checkInOf.get(lessonKey(lesson));
      const exitTicket = ticketOf.get(lessonKey(lesson));
      const status = ticketStatus(checkIn?.status ?? 'missing', exitTicket && ticketKind(exitTicket.submittedAt !== null, exitTicket.excused));
      const closed = exitClosesAt(lesson).getTime() <= now.getTime();
      return {
        lesson,
        attendance: attendanceOf(checkIn),
        ticket: status === 'missing' && !closed ? 'open' : status,
        handedIn: exitTicket?.submittedAt ? exitTicket : null,
      };
    });
}

/**
 * What the Verlauf says about a lesson's ticket: "Abgegeben 08:52" wherever
 * she handed one in, else "Exit-Ticket fehlt" (`missing`, which goes into the
 * oral grade), "… entschuldigt" or "… offen bis 09:15"; null when none was
 * owed and none handed in.
 */
export function ticketMark(e: HistoryEntry): { label: string; missing: boolean } | null {
  if (e.handedIn?.submittedAt) return { label: handedInLabel(e.handedIn.submittedAt), missing: false };
  switch (e.ticket) {
    case 'missing':
      return { label: 'Exit-Ticket fehlt', missing: true };
    case 'excused':
      return { label: 'Exit-Ticket entschuldigt', missing: false };
    case 'open':
      return { label: `Exit-Ticket offen bis ${formatTime(exitClosesAt(e.lesson))}`, missing: false };
    default:
      return null;
  }
}

/** "08:15–09:00 · pünktlich · Abgegeben 08:52": when, her status and her ticket's. */
function entryLine(e: HistoryEntry): string {
  return [formatTimes(e.lesson.startsAt, e.lesson.endsAt), attendanceLabel(e.attendance), ticketMark(e)?.label].filter(Boolean).join(' · ');
}

/** Free text as a quote, line by line, so nothing the student wrote turns into a heading of the export. */
function quote(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

function section(title: string, body: string): string {
  return `### ${title}\n\n${body}\n`;
}

/**
 * The student's own Verlauf of a course as Markdown, oldest lesson first, to
 * keep after the course is archived: per lesson its day, topic, her status,
 * both parts of her exit ticket, her goal ratings and the homework. It speaks
 * to the student, as the app does.
 */
export function historyMarkdown(course: Course, entries: HistoryEntry[]): string {
  const head = `# ${course.name}\n\nDein Verlauf aus Takt: deine Lektionen, dein Status, deine Notizen und Exit-Tickets.\n`;
  if (entries.length === 0) return `${head}\nNoch keine vergangenen Lektionen.\n`;
  const lessons = [...entries].reverse().map((e) => {
    const { lesson: l, handedIn: ticket } = e;
    const topic = l.topic.replace(/\s+/g, ' ').trim() || 'Noch kein Thema';
    const parts = [`## ${formatDate(l.startsAt)} · ${topic}\n`, `${entryLine(e)}\n`];
    if (ticket?.note.trim()) parts.push(section('Was haben wir gemacht?', quote(ticket.note)));
    if (ticket) parts.push(section('Was war unklar?', quote(ticket.unclear)));
    const ratings = Object.entries(ticket?.ratings ?? {});
    if (ratings.length > 0) parts.push(section('Wie sicher du bei den Zielen warst', ratings.map(([g, n]) => `- ${g} – ${n} von 4`).join('\n')));
    if (l.homework.trim()) parts.push(section('Hausaufgaben', quote(l.homework)));
    return parts.join('\n');
  });
  return [head, ...lessons].join('\n');
}

/** "Verlauf 3a · Informatik.md", without the characters a file name can't hold. */
export function exportName(course: Course): string {
  return `Verlauf ${course.name.replace(/[\\/:*?"<>|]/g, '-')}.md`;
}
