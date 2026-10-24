import { afterEach, describe, expect, it } from 'vitest';
import { formatDate, formatTime } from '$lib/utils/formatDate';
import { fromInputValue, toInputValue } from './inputHelpers';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

const ZONES = ['America/Los_Angeles', 'Europe/Riga', 'Pacific/Auckland', 'UTC'];

describe('datetime input round-trip', () => {
  it('stores the typed wall-clock as UTC and shows it back unchanged in any host zone', () => {
    const baseline = `${formatDate('2026-03-04T23:30:00Z')} ${formatTime('2026-03-04T23:30:00Z')}`;
    for (const tz of ZONES) {
      process.env.TZ = tz;
      const stored = fromInputValue('datetime', '2026-03-04T23:30');
      expect(new Date(stored!).toISOString()).toBe('2026-03-04T23:30:00.000Z');
      expect(`${formatDate(stored)} ${formatTime(stored)}`).toBe(baseline);
      expect(toInputValue('datetime-local', new Date(stored!))).toBe('2026-03-04T23:30');
      expect(toInputValue('datetime-local', stored)).toBe('2026-03-04T23:30');
    }
  });

  it('keeps a date-only value on the same calendar day', () => {
    for (const tz of ZONES) {
      process.env.TZ = tz;
      const stored = fromInputValue('date', '2026-03-04');
      expect(toInputValue('date', new Date(stored!))).toBe('2026-03-04');
      expect(formatDate(stored)).toBe(formatDate('2026-03-04T12:00:00Z'));
    }
  });

  it('treats a cleared input as no value and passes non-local strings through', () => {
    expect(fromInputValue('datetime', '')).toBeUndefined();
    expect(fromInputValue('datetime', '2026-03-04T09:30:00Z')).toBe('2026-03-04T09:30:00Z');
    expect(fromInputValue('text', 'x')).toBe('x');
  });
});
