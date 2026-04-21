/**
 * Local calendar utilities. Avoid `Date.toISOString().slice(0, 10)` for “today” —
 * that uses UTC and can shift the civil date vs the user’s timezone (wrong week).
 */

/** Today’s calendar date in the browser’s local timezone (YYYY-MM-DD). */
export function localDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Sunday beginning the week that contains `isoDate` (Sun→Sat weeks).
 * `isoDate` is YYYY-MM-DD read as a local civil date (not UTC midnight in London).
 */
export function normalizeWeekStartSunday(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}
