import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLES_KLAR,
  closedLabel,
  draftOf,
  openLabel,
  exitRefusal,
  exitTicketState,
  handedInLabel,
  submissionOf,
  type ExitTicket,
} from '../src/lib/exitTicket.ts';
import { exitClosesAt, exitOpensAt, isExitOpen, type Lesson } from '../src/lib/lessons.ts';

// 08:15–09:00 Zurich time (UTC+1 in winter): the ticket opens at 08:50 and
// closes at 09:15.
const lesson: Lesson = {
  teacherId: 'anna',
  id: '2026-11-02_0815_inf',
  courseId: 'inf',
  startsAt: new Date('2026-11-02T08:15:00+01:00'),
  endsAt: new Date('2026-11-02T09:00:00+01:00'),
  exitOpenedAt: null,
  title: 'INF',
  topic: 'XOR',
  goals: ['Ich kann XOR anwenden.', 'Ich kann ein One-Time-Pad erklären.'],
  standing: [],
  homework: '',
  materials: [],
};

const at = (iso: string, deltaMs = 0) => new Date(new Date(iso).getTime() + deltaMs);

function ticket(extra: Partial<ExitTicket> = {}): ExitTicket {
  return {
    teacherId: 'anna',
    lessonId: lesson.id,
    note: 'Wir haben XOR geübt.',
    unclear: 'Warum ist der Schlüssel so lang?',
    ratings: { 'Ich kann XOR anwenden.': 3 },
    submittedAt: new Date('2026-11-02T08:52:00+01:00'),
    ...extra,
  };
}

test('the window: from ten minutes before the end to fifteen after it', () => {
  assert.deepEqual(exitOpensAt(lesson), new Date('2026-11-02T08:50:00+01:00'));
  assert.deepEqual(exitClosesAt(lesson), new Date('2026-11-02T09:15:00+01:00'));
});

test('a moment before it opens the ticket is closed, and shows nothing', () => {
  assert.equal(isExitOpen(lesson, at('2026-11-02T08:50:00+01:00', -1)), false);
  assert.deepEqual(exitTicketState(lesson, undefined, at('2026-11-02T08:50:00+01:00', -1)), { kind: 'not-open' });
});

test('it opens ten minutes before the end', () => {
  assert.equal(isExitOpen(lesson, at('2026-11-02T08:50:00+01:00')), true);
  assert.deepEqual(exitTicketState(lesson, undefined, at('2026-11-02T08:50:00+01:00')), {
    kind: 'open',
    closesAt: new Date('2026-11-02T09:15:00+01:00'),
    handedInAt: null,
  });
});

test('it is open until a moment before fifteen minutes after the end', () => {
  assert.equal(isExitOpen(lesson, at('2026-11-02T09:15:00+01:00', -1)), true);
  assert.equal(exitTicketState(lesson, undefined, at('2026-11-02T09:15:00+01:00', -1)).kind, 'open');
});

test('fifteen minutes after the end it is closed, and says so', () => {
  assert.equal(isExitOpen(lesson, at('2026-11-02T09:15:00+01:00')), false);
  assert.deepEqual(exitTicketState(lesson, undefined, at('2026-11-02T09:15:00+01:00')), {
    kind: 'closed',
    closedAt: new Date('2026-11-02T09:15:00+01:00'),
    handedInAt: null,
  });
});

test('the teacher\'s early open moves the start', () => {
  const opened = { ...lesson, exitOpenedAt: new Date('2026-11-02T08:30:00+01:00') };
  assert.deepEqual(exitOpensAt(opened), new Date('2026-11-02T08:30:00+01:00'));
  assert.equal(isExitOpen(opened, at('2026-11-02T08:30:00+01:00', -1)), false);
  assert.equal(isExitOpen(opened, at('2026-11-02T08:30:00+01:00')), true);
});

test('an "early" open after the usual start doesn\'t move it later', () => {
  const opened = { ...lesson, exitOpenedAt: new Date('2026-11-02T08:55:00+01:00') };
  assert.deepEqual(exitOpensAt(opened), new Date('2026-11-02T08:50:00+01:00'));
  assert.equal(isExitOpen(opened, at('2026-11-02T08:50:00+01:00')), true);
});

test('handed in, the ticket stays open to edit, and closed it remembers when', () => {
  const done = ticket();
  assert.deepEqual(exitTicketState(lesson, done, at('2026-11-02T08:55:00+01:00')), {
    kind: 'open',
    closesAt: new Date('2026-11-02T09:15:00+01:00'),
    handedInAt: done.submittedAt,
  });
  assert.deepEqual(exitTicketState(lesson, done, at('2026-11-02T10:00:00+01:00')), {
    kind: 'closed',
    closedAt: new Date('2026-11-02T09:15:00+01:00'),
    handedInAt: done.submittedAt,
  });
});

test('a ticket the teacher excused, but nothing handed in, counts as not handed in', () => {
  const excused = ticket({ unclear: '', ratings: {}, note: '', submittedAt: null });
  assert.equal(exitTicketState(lesson, excused, at('2026-11-02T08:55:00+01:00')).kind, 'open');
  assert.deepEqual(exitTicketState(lesson, excused, at('2026-11-02T08:55:00+01:00')), {
    kind: 'open',
    closesAt: new Date('2026-11-02T09:15:00+01:00'),
    handedInAt: null,
  });
});

test('a new draft is empty, with no goal rated', () => {
  assert.deepEqual(draftOf(undefined, lesson.goals), { note: '', unclear: '', allesKlar: false, ratings: {} });
});

test('a handed-in ticket is the draft again, for the goals the lesson still has', () => {
  const done = ticket({ ratings: { 'Ich kann XOR anwenden.': 3, 'Ein Ziel, das es nicht mehr gibt': 2 } });
  assert.deepEqual(draftOf(done, lesson.goals), {
    note: 'Wir haben XOR geübt.',
    unclear: 'Warum ist der Schlüssel so lang?',
    allesKlar: false,
    ratings: { 'Ich kann XOR anwenden.': 3 },
  });
});

test('"Alles klar" comes back as the choice, not as text', () => {
  assert.deepEqual(draftOf(ticket({ unclear: ALLES_KLAR }), lesson.goals), {
    note: 'Wir haben XOR geübt.',
    unclear: '',
    allesKlar: true,
    ratings: { 'Ich kann XOR anwenden.': 3 },
  });
});

test('a submission trims what was unclear and keeps only ratings of the lesson\'s goals', () => {
  assert.deepEqual(
    submissionOf(
      { note: '  Notiz ', unclear: '  Warum? \n', allesKlar: false, ratings: { 'Ich kann XOR anwenden.': 4, 'Weg': 2 } },
      lesson.goals,
    ),
    { submission: { note: '  Notiz ', unclear: 'Warum?', ratings: { 'Ich kann XOR anwenden.': 4 } } },
  );
});

test('"Alles klar" is the answer, whatever the field still holds', () => {
  assert.deepEqual(submissionOf({ note: '', unclear: 'egal', allesKlar: true, ratings: {} }, lesson.goals), {
    submission: { note: '', unclear: ALLES_KLAR, ratings: {} },
  });
});

test('nothing unclear and no "Alles klar" is refused before it is sent', () => {
  assert.deepEqual(submissionOf({ note: 'x', unclear: ' \n ', allesKlar: false, ratings: {} }, lesson.goals), {
    problem: 'Schreib, was unklar war, oder wähle «Alles klar».',
  });
});

test('a server refusal says why', () => {
  assert.equal(exitRefusal('exit_ticket_not_open', lesson), 'Das Exit-Ticket öffnet um 08:50.');
  assert.equal(exitRefusal('exit_ticket_closed', lesson), 'Das Exit-Ticket ist seit 09:15 geschlossen.');
  assert.equal(exitRefusal('exit_ticket_not_enrolled', lesson), 'Du bist nicht in diesem Kurs eingeschrieben.');
  assert.equal(exitRefusal('exit_ticket_unclear_blank', lesson), 'Schreib, was unklar war, oder wähle «Alles klar».');
  assert.equal(exitRefusal('exit_ticket_invalid_ratings', lesson), 'Wähle bei jedem Ziel –, 1, 2, 3 oder 4.');
  assert.equal(exitRefusal(undefined, lesson), 'Abgeben hat nicht geklappt. Bist du online?');
});

test('the handed-in line says when', () => {
  assert.equal(handedInLabel(new Date('2026-11-02T08:52:00+01:00')), 'Abgegeben 08:52');
});


test('closed, it says since when, and whether it was handed in', () => {
  const closedAt = new Date('2026-11-02T09:15:00+01:00');
  assert.equal(closedLabel(closedAt, new Date('2026-11-02T08:52:00+01:00')), 'Das Exit-Ticket ist seit 09:15 geschlossen. Abgegeben 08:52.');
  assert.equal(closedLabel(closedAt, null), 'Das Exit-Ticket ist seit 09:15 geschlossen. Du hast keines abgegeben.');
});

test('open, it says until when, and once handed in that it can still change', () => {
  const closesAt = new Date('2026-11-02T09:15:00+01:00');
  assert.equal(openLabel(closesAt, null), 'Offen bis 09:15');
  assert.equal(openLabel(closesAt, new Date('2026-11-02T08:52:00+01:00')), 'Abgegeben 08:52 · du kannst bis 09:15 ändern');
});
