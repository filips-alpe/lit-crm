import { describe, expect, it } from 'vitest';
import { historyColumnLabel, historyDisplay, historyValue } from './format';

describe('historyValue', () => {
  it('shows null and blank as the empty label', () => {
    expect(historyValue(null, 'empty')).toBe('empty');
    expect(historyValue('', 'empty')).toBe('empty');
    expect(historyValue([], 'empty')).toBe('empty');
  });
  it('flattens whitespace, joins lists and cuts long text', () => {
    expect(historyValue('a\n  b', 'x')).toBe('a b');
    expect(historyValue(['u', 'v'], 'x')).toBe('u, v');
    expect(historyValue(true, 'x')).toBe('true');
    const long = historyValue('y'.repeat(200), 'x');
    expect(long).toHaveLength(80);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('historyColumnLabel', () => {
  const layout = { fields: [{ label: 'Title', writeTo: 'title' }] };
  it('uses the layout label, else the column name', () => {
    expect(historyColumnLabel('title', layout)).toBe('Title');
    expect(historyColumnLabel('note', layout)).toBe('note');
  });
});

describe('historyDisplay', () => {
  const text = { empty: 'empty', hidden: 'hidden record', untitled: 'Untitled' };
  it('formats dates with the locale formatter, not raw ISO', () => {
    expect(historyDisplay('date', '2026-01-05T00:00:00.000Z', undefined, text)).toBe('Jan 5, 2026');
    expect(historyDisplay('start', '2026-01-05T14:30:00.000Z', undefined, text)).toContain(
      'Jan 5, 2026',
    );
    expect(historyDisplay('date', 'garbage', undefined, text)).toBe('garbage');
  });
  it('shows a resolved relation, a neutral label when hidden, and untitled when blank', () => {
    expect(historyDisplay('recordId', 'id1', { label: 'Letter' }, text)).toBe('Letter');
    expect(historyDisplay('recordId', 'id1', { label: null }, text)).toBe('hidden record');
    expect(historyDisplay('recordId', 'id1', { label: '' }, text)).toBe('Untitled');
  });
  it('leaves other values to historyValue', () => {
    expect(historyDisplay('title', null, undefined, text)).toBe('empty');
  });
});
