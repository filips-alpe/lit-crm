import { describe, expect, it } from 'vitest';
import { historyColumnLabel, historyValue } from './format';

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
