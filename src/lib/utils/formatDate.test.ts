import { afterEach, describe, expect, it } from 'vitest';
import { calendarParts, formatDate, formatTime } from './formatDate';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

const SAME_DAY = formatDate('2026-01-05T12:00:00Z');

describe('formatDate', () => {
  it('names the calendar day in the app locale', () => {
    expect(SAME_DAY).toMatch(/Jan/);
    expect(SAME_DAY).toMatch(/\b5\b/);
    expect(SAME_DAY).toMatch(/2026/);
  });

  it('returns an empty label for missing or invalid values', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });

  it('formats a UTC-midnight date as that same calendar day in any host timezone', () => {
    for (const tz of ['America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
      process.env.TZ = tz;
      expect(formatDate(new Date('2026-01-05T00:00:00Z'))).toBe(SAME_DAY);
      expect(formatDate('2026-01-05T00:00:00.000Z')).toBe(SAME_DAY);
    }
  });
});

describe('calendarParts', () => {
  it('uses the UTC day and a short month name', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(calendarParts('2026-03-01T00:00:00Z')).toEqual({ day: 1, month: 'Mar' });
  });

  it('is null for missing or invalid values', () => {
    expect(calendarParts(null)).toBeNull();
    expect(calendarParts('nope')).toBeNull();
  });
});

describe('formatTime', () => {
  it('formats the UTC time of day', () => {
    process.env.TZ = 'Pacific/Auckland';
    expect(formatTime('2026-03-01T14:30:00Z')).toMatch(/^(2:30\s?PM|14:30)$/);
    expect(formatTime(null)).toBe('');
  });
});
