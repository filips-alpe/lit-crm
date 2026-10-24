import { describe, expect, it } from 'vitest';
import { asText, byWriteTo, firstByWriteTo, letterSummary, present, textOf } from './select';
import type { RendererFieldValue } from './props';

function field(over: Partial<RendererFieldValue> & { writeTo: string }): RendererFieldValue {
  return { label: over.writeTo, kind: 'text', value: over.writeTo, raw: over.writeTo, ...over };
}

const fields = {
  who: field({ writeTo: 'title', value: 'Acme' }),
  amount: field({ writeTo: 'sum', kind: 'number', value: '€1,200' }),
  party: field({ writeTo: 'to', value: 'The Courant' }),
  refs: field({ writeTo: 'references', kind: 'list', value: ['a', 'b'] }),
  empty: field({ writeTo: 'from', value: null }),
};

describe('byWriteTo', () => {
  it('returns the field whose writeTo matches', () => {
    expect(byWriteTo(fields, 'sum')?.value).toBe('€1,200');
  });
  it('returns undefined when no field targets the column', () => {
    expect(byWriteTo(fields, 'hours')).toBeUndefined();
  });
});

describe('firstByWriteTo', () => {
  it('tries columns in priority order', () => {
    expect(firstByWriteTo(fields, ['from', 'to'])?.writeTo).toBe('from');
    expect(firstByWriteTo(fields, ['hours', 'to'])?.writeTo).toBe('to');
  });
  it('returns undefined when none match', () => {
    expect(firstByWriteTo(fields, ['hours', 'start'])).toBeUndefined();
  });
});

describe('present', () => {
  it('is true only for a field with a non-null value', () => {
    expect(present(fields.who)).toBe(true);
    expect(present(fields.empty)).toBe(false);
    expect(present(undefined)).toBe(false);
  });
});

describe('asText', () => {
  it('joins arrays with commas and passes strings through', () => {
    expect(asText(['a', 'b'])).toBe('a, b');
    expect(asText('plain')).toBe('plain');
    expect(asText(null)).toBe('');
  });
});

describe('textOf', () => {
  it('returns the display text, or null when absent or empty', () => {
    expect(textOf(fields, 'references')).toBe('a, b');
    expect(textOf(fields, 'from')).toBeNull();
    expect(textOf(fields, 'hours')).toBeNull();
  });
});

describe('letterSummary', () => {
  it('prefers the recipient as correspondent and flags outgoing', () => {
    expect(letterSummary(fields)).toEqual({
      outgoing: true,
      correspondent: 'The Courant',
      title: 'Acme',
    });
  });
  it('is incoming with empty defaults when only an empty sender exists', () => {
    expect(letterSummary({ empty: fields.empty })).toEqual({
      outgoing: false,
      correspondent: null,
      title: '',
    });
  });
});
