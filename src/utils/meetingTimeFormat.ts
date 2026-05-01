/**
 * Render a UTC ISO timestamp in Europe/London time, automatically choosing
 * the correct GMT/BST label based on the date (handles DST switchover).
 *
 * Why: previously we rendered times with toLocaleTimeString without a
 * timeZone option, which used the server/runtime's locale and frequently
 * mis-labelled BST dates as "GMT". This helper guarantees correct UK
 * civil time and label.
 */

const ukTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const ukDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const ukTzNameFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  timeZoneName: 'short',
});

/** Format a date as e.g. "14:00" in Europe/London (no seconds). */
export function formatUkTime(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return ukTimeFormatter.format(d);
}

/** Returns "GMT" or "BST" for the given moment, per UK civil rules. */
export function getUkTimezoneLabel(input: string | Date | null | undefined): string {
  if (!input) return 'GMT';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return 'GMT';
  const parts = ukTzNameFormatter.formatToParts(d);
  const tz = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
  return tz; // "GMT" or "BST"
}

/** Format e.g. "14:00 BST" — combined helper. */
export function formatUkTimeWithLabel(input: string | Date | null | undefined): string {
  if (!input) return '';
  return `${formatUkTime(input)} ${getUkTimezoneLabel(input)}`;
}

/** Format e.g. "Tuesday, 28 April 2026" in Europe/London. */
export function formatUkDateLong(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return ukDateFormatter.format(d);
}

/**
 * Heuristic: a stored start_time whose seconds and ms are both zero is
 * almost certainly a scheduled/typed time rather than a true recording
 * click moment (which would have ms > 0 from Date.now()).
 *
 * Use this to flag meetings whose metadata may not reflect the actual
 * recording moment, so the user can verify and correct it.
 */
export function isSuspectStartTime(input: string | Date | null | undefined): boolean {
  if (!input) return false;
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}
