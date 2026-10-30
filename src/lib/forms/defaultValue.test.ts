import { describe, expect, it } from 'vitest';
import { defaultToText, isValidDefault, parseDefault, supportsDefault } from './defaultValue';

describe('parseDefault', () => {
  it('treats blank text as "no default" for every kind', () => {
    for (const kind of ['text', 'number', 'date', 'list'] as const) {
      expect(parseDefault(kind, '  ')).toEqual({ ok: true, value: undefined });
    }
  });

  it('types the value per kind', () => {
    expect(parseDefault('text', 'hi')).toEqual({ ok: true, value: 'hi' });
    expect(parseDefault('number', '12.5')).toEqual({ ok: true, value: 12.5 });
    expect(parseDefault('number', '0')).toEqual({ ok: true, value: 0 });
    expect(parseDefault('list', 'a\n\n b \nc')).toEqual({ ok: true, value: ['a', 'b', 'c'] });
    expect(parseDefault('date', '2024-05-06')).toEqual({ ok: true, value: '2024-05-06' });
    expect(parseDefault('datetime', '2024-05-06T09:30')).toEqual({
      ok: true,
      value: '2024-05-06T09:30Z',
    });
    expect(parseDefault('location', '51.5,-0.1')).toEqual({ ok: true, value: '51.5,-0.1' });
  });

  it('rejects text that does not fit the kind', () => {
    expect(parseDefault('number', 'abc')).toEqual({ ok: false });
    expect(parseDefault('number', '1e400')).toEqual({ ok: false });
    expect(parseDefault('date', 'soon')).toEqual({ ok: false });
    expect(parseDefault('location', '200,0')).toEqual({ ok: false });
  });
});

describe('defaultToText', () => {
  it('renders stored defaults back into editor text', () => {
    expect(defaultToText('text', undefined)).toBe('');
    expect(defaultToText('number', 0)).toBe('0');
    expect(defaultToText('list', ['a', 'b'])).toBe('a\nb');
    expect(defaultToText('datetime', '2024-05-06T09:30Z')).toBe('2024-05-06T09:30');
    expect(defaultToText('date', '2024-05-06')).toBe('2024-05-06');
  });

  it('round-trips through parseDefault', () => {
    for (const [kind, value] of [
      ['number', 7],
      ['list', ['x', 'y']],
      ['datetime', '2024-05-06T09:30Z'],
    ] as const) {
      const parsed = parseDefault(kind, defaultToText(kind, value));
      expect(parsed).toEqual({ ok: true, value });
    }
  });
});

describe('supportsDefault / isValidDefault', () => {
  it('offers defaults for everything but relations', () => {
    expect(supportsDefault('text')).toBe(true);
    expect(supportsDefault('user')).toBe(false);
    expect(supportsDefault('record')).toBe(false);
  });

  it('validates against the kind schema', () => {
    expect(isValidDefault('number', 3)).toBe(true);
    expect(isValidDefault('number', 'x')).toBe(false);
  });
});
