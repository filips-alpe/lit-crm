import { describe, expect, it } from 'vitest';
import { DEFAULT_TYPE_COLOR, layoutSchema, recipientColumn, typeSchema } from './types';

describe('typeSchema layout validation', () => {
  it('accepts a layout with text, number, and date kinds', () => {
    const result = typeSchema.safeParse({
      id: '',
      code: 'OK',
      layout: {
        fields: [
          { id: 'a', label: 'A', kind: 'text', writeTo: 'note' },
          { id: 'b', label: 'B', kind: 'number', writeTo: 'sum' },
          { id: 'c', label: 'C', kind: 'date', writeTo: 'date' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a layout with user and record relation kinds', () => {
    const result = typeSchema.safeParse({
      id: '',
      code: 'REL',
      layout: {
        fields: [
          { id: 'a', label: 'Author', kind: 'user', writeTo: 'creatorId' },
          { id: 'b', label: 'Assignee', kind: 'user', writeTo: 'assigneeId' },
          { id: 'c', label: 'Replies to', kind: 'record', writeTo: 'recordId' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a field with an unknown kind', () => {
    const result = typeSchema.safeParse({
      id: '',
      code: 'BAD',
      layout: {
        fields: [{ id: 'a', label: 'A', kind: 'color', writeTo: 'note' }],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a layout with two fields sharing the same label', () => {
    const result = typeSchema.safeParse({
      id: '',
      code: 'DUP',
      layout: {
        fields: [
          { id: 'a', label: 'Same', kind: 'text', writeTo: 'note' },
          { id: 'b', label: 'Same', kind: 'text', writeTo: 'title' },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a layout with two fields sharing the same writeTo column', () => {
    const result = typeSchema.safeParse({
      id: '',
      code: 'DUPW',
      layout: {
        fields: [
          { id: 'a', label: 'A', kind: 'text', writeTo: 'note' },
          { id: 'b', label: 'B', kind: 'text', writeTo: 'note' },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid color and iconSeed', () => {
    const result = typeSchema.safeParse({
      id: '',
      code: 'STYLED',
      color: '#22c55e',
      iconSeed: 'abc123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe('#22c55e');
      expect(result.data.iconSeed).toBe('abc123');
    }
  });

  it('rejects a color that is not a #RRGGBB hex', () => {
    const result = typeSchema.safeParse({ id: '', code: 'BAD', color: 'red' });
    expect(result.success).toBe(false);
  });

  it('defaults color to the shared default when omitted', () => {
    const result = typeSchema.safeParse({ id: '', code: 'OK' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.color).toBe(DEFAULT_TYPE_COLOR);
  });

  it.each(['id', 'status', 'typeId', 'createdAt', 'references'])(
    'rejects a text field that writes to the non-text column %s',
    (writeTo) => {
      const result = typeSchema.safeParse({
        id: '',
        code: 'MASS',
        layout: { fields: [{ id: 'a', label: 'A', kind: 'text', writeTo }] },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['layout', 'fields', 0, 'writeTo']);
      }
    },
  );

  it('accepts a location field writing to a geo string column', () => {
    const result = typeSchema.safeParse({
      id: '',
      code: 'GEO',
      layout: { fields: [{ id: 'a', label: 'Where', kind: 'location', writeTo: 'fromGeo' }] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty or oversized field label', () => {
    const field = (label: string) => ({ id: 'a', label, kind: 'text', writeTo: 'note' });
    const parse = (label: string) =>
      typeSchema.safeParse({ id: '', code: 'L', layout: { fields: [field(label)] } });
    expect(parse('  ').success).toBe(false);
    expect(parse('x'.repeat(81)).success).toBe(false);
    expect(parse('x'.repeat(80)).success).toBe(true);
  });

  it('rejects a layout with zero fields', () => {
    const result = typeSchema.safeParse({
      id: '',
      code: 'EMPTY',
      layout: { fields: [] },
    });
    expect(result.success).toBe(false);
  });

  it('still allows omitting layout entirely (null/undefined)', () => {
    expect(typeSchema.safeParse({ id: '', code: 'NO_LAYOUT' }).success).toBe(true);
    expect(typeSchema.safeParse({ id: '', code: 'NULL_LAYOUT', layout: null }).success).toBe(true);
  });
});

describe('recipientColumn', () => {
  it('returns "to" when the layout has a field writing to `to`', () => {
    const col = recipientColumn({
      fields: [
        { id: 'from', label: 'From', kind: 'text', writeTo: 'from' },
        { id: 'to', label: 'To', kind: 'text', writeTo: 'to' },
      ],
    });
    expect(col).toBe('to');
  });

  it('falls back to "from" when there is no `to` field', () => {
    const col = recipientColumn({
      fields: [{ id: 'from', label: 'Received from', kind: 'text', writeTo: 'from' }],
    });
    expect(col).toBe('from');
  });

  it('returns null when the layout has neither a `to` nor a `from` field', () => {
    const col = recipientColumn({
      fields: [{ id: 'amount', label: 'Amount', kind: 'number', writeTo: 'sum' }],
    });
    expect(col).toBeNull();
  });

  it('returns null for a missing layout', () => {
    expect(recipientColumn(null)).toBeNull();
    expect(recipientColumn(undefined)).toBeNull();
  });
});

describe('layout defaultValue validation', () => {
  const field = (kind: string, writeTo: string, defaultValue: unknown) => ({
    fields: [{ id: 'a', label: 'A', kind, writeTo, defaultValue }],
  });

  it('accepts defaults that fit the field kind', () => {
    expect(layoutSchema.safeParse(field('text', 'note', 'hi')).success).toBe(true);
    expect(layoutSchema.safeParse(field('number', 'sum', 12.5)).success).toBe(true);
    expect(layoutSchema.safeParse(field('list', 'references', ['a'])).success).toBe(true);
    expect(layoutSchema.safeParse(field('date', 'date', '2024-05-06')).success).toBe(true);
  });

  it('rejects defaults that do not fit, pointing at the field', () => {
    for (const bad of [
      field('number', 'sum', 'abc'),
      field('list', 'references', 'not-a-list'),
      field('date', 'date', 'not-a-date'),
      field('location', 'fromGeo', '999,999'),
    ]) {
      const r = layoutSchema.safeParse(bad);
      expect(r.success).toBe(false);
      expect(JSON.stringify(r.error?.issues.map((i) => i.path))).toContain('defaultValue');
    }
  });
});
