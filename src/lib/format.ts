/** Dates and times as the student reads them: German, on the Swiss clock, whatever the laptop's own zone. */

const ZONE = 'Europe/Zurich';

const time = new Intl.DateTimeFormat('de-CH', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('de-CH', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' });

/** "08:15" */
export function formatTime(d: Date): string {
  return time.format(d);
}

/** "08:15–09:00" */
export function formatTimes(start: Date, end: Date): string {
  return `${time.format(start)}–${time.format(end)}`;
}

/** "Montag, 2. November" */
export function formatDay(d: Date): string {
  return day.format(d);
}
