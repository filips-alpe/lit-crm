import { getLocale } from '$lib/paraglide/runtime.js';

// Record dates are stored as UTC instants (date-only values at UTC midnight), so
// every label is formatted in UTC: the server render and the browser agree, and
// a date never slides to the previous day west of Greenwich. Month names follow
// the app locale, not the browser's.
const TZ = 'UTC';

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(getLocale(), { ...options, timeZone: TZ }).format(date)
    : '';
}

/** Locale date label ("5 Jan 2026") for a record's date or timestamp; '' for
 *  null/invalid. The one call site for cards, rows and renderers. */
export function formatDate(value: Date | string | null | undefined): string {
  return format(value, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Day-of-month and short month name for calendar-style tiles; null for
 *  null/invalid. */
export function calendarParts(
  value: Date | string | null | undefined,
): { day: number; month: string } | null {
  const date = toDate(value);
  if (!date) return null;
  return { day: date.getUTCDate(), month: format(date, { month: 'short' }) };
}

/** Locale time-of-day label ("14:30") for a timestamp; '' for null/invalid. */
export function formatTime(value: Date | string | null | undefined): string {
  return format(value, { hour: 'numeric', minute: '2-digit' });
}
