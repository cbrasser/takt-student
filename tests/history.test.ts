import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseHistory, exportName, historyMarkdown } from '../src/lib/history.ts';
import type { Course, Lesson } from '../src/lib/lessons.ts';

const course: Course = { teacherId: 'anna', id: 'inf', name: '3a · Informatik', siteUrl: 'https://lecture.seed.test/', semesters: [] };

/** A lesson of the course, 08:15–09:00 Zurich time on the given November day. */
function lesson(day: number, extra: Partial<Lesson> = {}): Lesson {
  const d = String(day).padStart(2, '0');
  return {
    teacherId: 'anna',
    id: `2026-11-${d}_0815_inf`,
    courseId: 'inf',
    startsAt: new Date(`2026-11-${d}T08:15:00+01:00`),
    endsAt: new Date(`2026-11-${d}T09:00:00+01:00`),
    reviewOpenedAt: null,
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

test('Verlauf: the course\'s lessons that have ended, newest first', () => {
  const first = lesson(2);
  const second = lesson(4);
  const running = lesson(9);
  const later = lesson(11);
  const otherCourse = lesson(3, { id: '2026-11-03_0815_mat', courseId: 'mat' });
  const otherTeacher = lesson(5, { teacherId: 'ben' });
  const now = new Date('2026-11-09T08:30:00+01:00');

  const history = courseHistory([later, second, otherCourse, running, first, otherTeacher], course, now);

  assert.deepEqual(history, [second, first]);
});

test('a lesson with an Umfrage is in the Verlauf like any other, and nothing of the Umfrage', () => {
  const reviewed = lesson(2, { review: ['Was hast du gut verstanden?', 'Was war unklar?'] });
  const now = new Date('2026-11-30T12:00:00+01:00');
  assert.deepEqual(courseHistory([reviewed], course, now), [reviewed]);
  const text = historyMarkdown(course, [reviewed]);
  assert.doesNotMatch(text, /Umfrage|Was war unklar|gut verstanden/);
});

test('the Markdown export: the lessons oldest first, with goals, homework and materials, and no status or ticket', () => {
  const xor = lesson(2, {
    topic: 'XOR',
    goals: ['Ich kann XOR anwenden.'],
    homework: 'Blatt 3,\n# Aufgaben 1–4',
    materials: [
      { title: 'XOR [Folien]', path: 'Informatik/Kryptologie/xor.md' },
      { title: 'One-Time-Pad', path: 'https://de.wikipedia.org/wiki/One-Time-Pad' },
      { title: 'Lokal', path: 'file:///C:/xor.pdf' },
    ],
  });
  const untitled = lesson(4, { topic: '' });
  const pad = lesson(9, { topic: 'One-Time-Pad' });
  const now = new Date('2026-11-30T12:00:00+01:00');

  assert.equal(
    historyMarkdown(course, courseHistory([pad, xor, untitled], course, now)),
    [
      '# 3a · Informatik',
      '',
      'Dein Verlauf aus Takt: Thema, Ziele, Hausaufgaben und Material jeder Lektion.',
      '',
      '## Montag, 2. November 2026 · XOR',
      '',
      '08:15–09:00',
      '',
      '### Ziele',
      '',
      '- Ich kann XOR anwenden.',
      '',
      '### Hausaufgaben',
      '',
      '> Blatt 3,',
      '> # Aufgaben 1–4',
      '',
      '### Material',
      '',
      '- [XOR \\[Folien\\]](<https://lecture.seed.test/Informatik/Kryptologie/xor.html>)',
      '- [One-Time-Pad](<https://de.wikipedia.org/wiki/One-Time-Pad>)',
      '- Lokal',
      '',
      '## Mittwoch, 4. November 2026 · Noch kein Thema',
      '',
      '08:15–09:00',
      '',
      '## Montag, 9. November 2026 · One-Time-Pad',
      '',
      '08:15–09:00',
      '',
    ].join('\n'),
  );
});

test('the export of a course without past lessons says so', () => {
  assert.equal(
    historyMarkdown(course, []),
    '# 3a · Informatik\n\nDein Verlauf aus Takt: Thema, Ziele, Hausaufgaben und Material jeder Lektion.\n\nNoch keine vergangenen Lektionen.\n',
  );
});

test('the export is named after the course, safe as a file name', () => {
  assert.equal(exportName(course), 'Verlauf 3a · Informatik.md');
  assert.equal(exportName({ ...course, name: 'BG/MA: "Mathe"?' }), 'Verlauf BG-MA- -Mathe--.md');
});
