/**
 * When the app re-reads, besides on start and when its window gets focus:
 * every 15 minutes. Pure, so it is tested without a clock.
 */

export const REFRESH_MS = 15 * 60_000;

/** Due when nothing has been read yet (or the last read failed before any did), or 15 minutes after the last read. */
export function refreshDue(loadedAt: Date | null, now: Date): boolean {
  return !loadedAt || now.getTime() - loadedAt.getTime() >= REFRESH_MS;
}
