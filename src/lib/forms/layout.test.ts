import { describe, expect, it } from 'vitest';
import {
  buildLayoutSchema,
  buildRecordFormSchema,
  defaultsFromLayout,
  recordFormDefaults,
  toSaveInput,
  valuesFromRecord,
} from './layout';

describe('defaultsFromLayout', () => {
  it('returns empty object for layout with no fields', () => {
    expect(defaultsFromLayout({ fields: [] })).toEqual({});
  });

  it('seeds each field with its declared defaultValue, ignoring duplicates', () => {
    const result = defaultsFromLayout({
      fields: [
        { id: 'a', label: 'A', kind: 'text', writeTo: 'note', defaultValue: 'hi' },
        { id: 'b', label: 'B', kind: 'number', writeTo: 'sum', defaultValue: 7 },
        { id: 'c', label: 'C', kind: 'text', writeTo: 'note', defaultValue: 'shadowed' },
      ],
    });
    expect(result).toEqual({ note: 'hi', sum: 7 });
  });

  it('omits fields without a defaultValue', () => {
    const result = defaultsFromLayout({
      fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'note' }],
    });
    expect(result).toEqual({});
  });

  it('defaults list fields to empty array when no defaultValue is set', () => {
    const result = defaultsFromLayout({
      fields: [{ id: 'a', label: 'A', kind: 'list', writeTo: 'references' }],
    });
    expect(result).toEqual({ references: [] });
  });
});

describe('buildLayoutSchema', () => {
  it('rejects payloads missing a required field', () => {
    const schema = buildLayoutSchema({
      fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'note', required: true }],
    });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('treats an empty string or empty list as missing for a required field', () => {
    const text = buildLayoutSchema({
      fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'note', required: true }],
    });
    expect(text.safeParse({ note: '' }).success).toBe(false);
    expect(text.safeParse({ note: 'x' }).success).toBe(true);
    const list = buildLayoutSchema({
      fields: [{ id: 'r', label: 'R', kind: 'list', writeTo: 'references', required: true }],
    });
    expect(list.safeParse({ references: [] }).success).toBe(false);
    expect(list.safeParse({ references: ['a'] }).success).toBe(true);
  });

  it('accepts payloads with all required fields present', () => {
    const schema = buildLayoutSchema({
      fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'note', required: true }],
    });
    expect(schema.safeParse({ note: 'hello' }).success).toBe(true);
  });

  it('coerces number fields from string input', () => {
    const schema = buildLayoutSchema({
      fields: [{ id: 'a', label: 'A', kind: 'number', writeTo: 'sum' }],
    });
    const result = schema.safeParse({ sum: '42' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sum).toBe(42);
  });

  it('validates list fields as string arrays', () => {
    const schema = buildLayoutSchema({
      fields: [{ id: 'a', label: 'A', kind: 'list', writeTo: 'references' }],
    });
    expect(schema.safeParse({ references: ['a', 'b'] }).success).toBe(true);
    expect(schema.safeParse({ references: 'not-an-array' }).success).toBe(false);
  });
});

describe('buildRecordFormSchema', () => {
  it('adds a projectIds string array that defaults to empty', () => {
    const schema = buildRecordFormSchema({
      fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'note' }],
    });
    const result = schema.safeParse({ note: 'hi' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.projectIds).toEqual([]);
  });

  it('accepts an explicit projectIds list', () => {
    const schema = buildRecordFormSchema({ fields: [] });
    const result = schema.safeParse({ projectIds: ['p1', 'p2'] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.projectIds).toEqual(['p1', 'p2']);
  });
});

describe('recordFormDefaults', () => {
  it('seeds layout defaults plus an empty projectIds', () => {
    expect(
      recordFormDefaults({
        fields: [{ id: 'a', label: 'A', kind: 'text', writeTo: 'note', defaultValue: 'hi' }],
      }),
    ).toEqual({ note: 'hi', projectIds: [] });
  });
});

describe('toSaveInput', () => {
  it('maps each field value to its writeTo column', () => {
    const layout = {
      fields: [
        { id: 'a', label: 'A', kind: 'text' as const, writeTo: 'note' },
        { id: 'b', label: 'B', kind: 'number' as const, writeTo: 'sum' },
      ],
    };
    expect(toSaveInput(layout, { note: 'hi', sum: 3 })).toEqual({ note: 'hi', sum: 3 });
  });

  it('passes list field array through unchanged', () => {
    const layout = {
      fields: [{ id: 'a', label: 'A', kind: 'list' as const, writeTo: 'references' }],
    };
    expect(toSaveInput(layout, { references: ['x', 'y'] })).toEqual({ references: ['x', 'y'] });
  });

  it('drops keys not declared in the layout', () => {
    const layout = {
      fields: [{ id: 'a', label: 'A', kind: 'text' as const, writeTo: 'note' }],
    };
    expect(toSaveInput(layout, { note: 'hi', stranger: 'x' })).toEqual({ note: 'hi' });
  });
});

describe('valuesFromRecord', () => {
  it('reads each layout field from its writeTo column on the record', () => {
    const layout = {
      fields: [
        { id: 'a', label: 'A', kind: 'text' as const, writeTo: 'title' },
        { id: 'b', label: 'B', kind: 'number' as const, writeTo: 'sum' },
      ],
    };
    const record = { title: 'Hi', sum: 7, ignored: 'x' };
    expect(valuesFromRecord(layout, record)).toEqual({ title: 'Hi', sum: 7 });
  });

  it('defaults list fields to an empty array when absent or non-array', () => {
    const layout = {
      fields: [{ id: 'a', label: 'A', kind: 'list' as const, writeTo: 'references' }],
    };
    expect(valuesFromRecord(layout, {})).toEqual({ references: [] });
    expect(valuesFromRecord(layout, { references: null })).toEqual({ references: [] });
    expect(valuesFromRecord(layout, { references: ['x'] })).toEqual({ references: ['x'] });
  });

  it('omits null/undefined columns so optional inputs render blank', () => {
    const layout = {
      fields: [
        { id: 'a', label: 'A', kind: 'text' as const, writeTo: 'title' },
        { id: 'b', label: 'B', kind: 'text' as const, writeTo: 'text' },
      ],
    };
    expect(valuesFromRecord(layout, { title: 'set', text: null })).toEqual({ title: 'set' });
  });

  it('passes dates through unchanged', () => {
    const layout = {
      fields: [{ id: 'a', label: 'A', kind: 'date' as const, writeTo: 'date' }],
    };
    const d = new Date('2026-03-04T00:00:00Z');
    expect(valuesFromRecord(layout, { date: d })).toEqual({ date: d });
  });

  it('round-trips with toSaveInput for the editable columns', () => {
    const layout = {
      fields: [
        { id: 'a', label: 'A', kind: 'text' as const, writeTo: 'from' },
        { id: 'b', label: 'B', kind: 'location' as const, writeTo: 'fromGeo' },
        { id: 'c', label: 'C', kind: 'list' as const, writeTo: 'references' },
      ],
    };
    const record = { from: 'B. Franklin', fromGeo: '51.5,-0.1', references: ['r1'] };
    expect(toSaveInput(layout, valuesFromRecord(layout, record))).toEqual(record);
  });
});
