/** Dates and times as the student reads them: German, on the Swiss clock, whatever the laptop's own zone. */

const ZONE = 'Europe/Zurich';

const time = new Intl.DateTimeFormat('de-CH', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' });
const date = new Intl.DateTimeFormat('de-CH', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const day = new Intl.DateTimeFormat('de-CH', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' });
const iso = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "08:15" */
export function formatTime(d: Date): string {
  return time.format(d);
}

/** "08:15–09:00" */
export function formatTimes(start: Date, end: Date): string {
  return `${time.format(start)}–${time.format(end)}`;
}

/** "Montag, 2. November · 08:15–09:00" */
export function formatWhen(start: Date, end: Date): string {
  return `${formatDay(start)} · ${formatTimes(start, end)}`;
}

/** "Montag, 2. November" */
export function formatDay(d: Date): string {
  return day.format(d);
}

/** "Montag, 2. November 2026": a day that is read again years later. */
export function formatDate(d: Date): string {
  return date.format(d);
}

/** "2026-11-02": the day on the Swiss clock, as the database's dates are. */
export function isoDay(d: Date): string {
  return iso.format(d);
}

// Noon UTC is the same day in Zurich, whatever the season.
const noonOf = (day: string) => new Date(`${day}T12:00:00Z`);

/** "Montag, 9. November" for "2026-11-09", an assessment's day. */
export function formatIsoDay(day: string): string {
  return formatDay(noonOf(day));
}

const dayMonth = new Intl.DateTimeFormat('de-CH', { timeZone: ZONE, day: 'numeric', month: 'long' });

/** "Woche vom 9. November", for the week's Monday. */
export function formatWeek(monday: string): string {
  return `Woche vom ${dayMonth.format(noonOf(monday))}`;
}
