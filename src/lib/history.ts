/**
 * The Verlauf: a course's past lessons, every one alike, and its Markdown
 * export. Pure, so it is tested without a database or a clock.
 */
import { formatDate, formatTimes } from './format.ts';
import { courseKey, materialUrl, type Course, type Lesson } from './lessons.ts';

/** The course's lessons that have ended by `now`, newest first. */
export function courseHistory(lessons: Lesson[], course: Course, now: Date): Lesson[] {
  const key = courseKey(course);
  return lessons
    .filter((l) => courseKey(l) === key && l.endsAt.getTime() <= now.getTime())
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
}

/** Free text as a quote, line by line, so nothing in it turns into a heading of the export. */
function quote(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

/** One line of a list: line breaks and a link's brackets would break it. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

function section(title: string, body: string): string {
  return `### ${title}\n\n${body}\n`;
}

/** A material as a list item: linked where the Verlauf links it, else its title. */
function materialItem(title: string, path: string, siteUrl: string | null): string {
  const url = materialUrl(path, siteUrl);
  const name = oneLine(title);
  return url ? `- [${name.replace(/[[\]]/g, '\\$&')}](<${url}>)` : `- ${name}`;
}

/**
 * The Verlauf of a course as Markdown, oldest lesson first, to keep after
 * the course is archived: per lesson its day, topic and time, the goals, the
 * homework and the materials.
 */
export function historyMarkdown(course: Course, lessons: Lesson[]): string {
  const head = `# ${course.name}\n\nDein Verlauf aus Takt: Thema, Ziele, Hausaufgaben und Material jeder Lektion.\n`;
  if (lessons.length === 0) return `${head}\nNoch keine vergangenen Lektionen.\n`;
  const parts = [...lessons].reverse().map((l) => {
    const topic = oneLine(l.topic) || 'Noch kein Thema';
    const out = [`## ${formatDate(l.startsAt)} · ${topic}\n`, `${formatTimes(l.startsAt, l.endsAt)}\n`];
    if (l.goals.length > 0) out.push(section('Ziele', l.goals.map((g) => `- ${oneLine(g)}`).join('\n')));
    if (l.homework.trim()) out.push(section('Hausaufgaben', quote(l.homework)));
    if (l.materials.length > 0) out.push(section('Material', l.materials.map((m) => materialItem(m.title, m.path, course.siteUrl)).join('\n')));
    return out.join('\n');
  });
  return [head, ...parts].join('\n');
}

/** "Verlauf 3a · Informatik.md", without the characters a file name can't hold. */
export function exportName(course: Course): string {
  return `Verlauf ${course.name.replace(/[\\/:*?"<>|]/g, '-')}.md`;
}
