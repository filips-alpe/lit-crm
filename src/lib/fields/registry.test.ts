import { describe, expect, it } from 'vitest';
import { FIELD_TYPES, getFieldType, parseLatLng } from './registry';

describe('field-type registry', () => {
  it('defines a field type for every kind', () => {
    expect(Object.keys(FIELD_TYPES).sort()).toEqual([
      'date',
      'datetime',
      'list',
      'location',
      'markdown',
      'number',
      'record',
      'text',
      'user',
    ]);
  });

  it('formats values per kind', () => {
    expect(getFieldType('text').format('note', '  hi  ')).toBe('hi');
    expect(getFieldType('text').format('note', '')).toBeNull();
    expect(getFieldType('number').format('hours', 3)).toBe('3 h');
    expect(getFieldType('number').format('sum', 0)).toBeNull();
    expect(getFieldType('list').format('references', ['a', '', 'b'])).toEqual(['a', 'b']);
  });

  it('exposes storage columns per kind', () => {
    expect(getFieldType('text').columns).toEqual([
      'note',
      'title',
      'description',
      'text',
      'unit',
      'from',
      'to',
    ]);
    expect(getFieldType('list').columns).toEqual(['references']);
    expect(getFieldType('number').columns).toEqual(['sum', 'hours', 'total']);
    expect(getFieldType('date').columns).toEqual(['date', 'start', 'end']);
    expect(getFieldType('user').columns).toEqual(['creatorId', 'assigneeId']);
    expect(getFieldType('record').columns).toEqual(['recordId']);
  });

  it('validates with the kind schema', () => {
    expect(getFieldType('number').schema().safeParse('42').success).toBe(true);
    expect(getFieldType('list').schema().safeParse(['a']).success).toBe(true);
    expect(getFieldType('list').schema().safeParse('nope').success).toBe(false);
    expect(getFieldType('user').schema().safeParse('abc123').success).toBe(true);
    expect(getFieldType('record').schema().safeParse('abc123').success).toBe(true);
    expect(getFieldType('user').schema().safeParse(42).success).toBe(false);
  });

  it('does not format a bare relation id (label resolves from the entity)', () => {
    expect(getFieldType('user').format('creatorId', 'abc123')).toBeNull();
    expect(getFieldType('record').format('recordId', 'abc123')).toBeNull();
  });

  it('formats a UTC-midnight date as the same calendar day in any host timezone', () => {
    const original = process.env.TZ;
    try {
      for (const tz of ['America/Los_Angeles', 'Pacific/Auckland']) {
        process.env.TZ = tz;
        expect(getFieldType('date').format('date', '2026-01-05T00:00:00.000Z')).toMatch(/\b5\b/);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect(getFieldType('date').format('date', null)).toBeNull();
    expect(getFieldType('datetime').format('start', 'not a date')).toBeNull();
  });
});

describe('parseLatLng', () => {
  it('parses a plain "lat,lng" pair', () => {
    expect(parseLatLng('51.5,-0.1')).toEqual({ lat: 51.5, lng: -0.1 });
  });

  it('tolerates whitespace around the comma', () => {
    expect(parseLatLng('  51.5 , -0.1 ')).toEqual({ lat: 51.5, lng: -0.1 });
  });

  it('parses integer coordinates', () => {
    expect(parseLatLng('40,-74')).toEqual({ lat: 40, lng: -74 });
  });

  it('returns null for malformed strings', () => {
    expect(parseLatLng('')).toBeNull();
    expect(parseLatLng('51.5')).toBeNull();
    expect(parseLatLng('51.5,')).toBeNull();
    expect(parseLatLng('a,b')).toBeNull();
    expect(parseLatLng('51.5,-0.1,7')).toBeNull();
  });

  it('returns null for out-of-range coordinates', () => {
    expect(parseLatLng('91,0')).toBeNull();
    expect(parseLatLng('-91,0')).toBeNull();
    expect(parseLatLng('0,181')).toBeNull();
    expect(parseLatLng('0,-181')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseLatLng(null)).toBeNull();
    expect(parseLatLng(undefined)).toBeNull();
    expect(parseLatLng(42)).toBeNull();
    expect(parseLatLng({ lat: 1, lng: 2 })).toBeNull();
  });
});

describe('location formatting', () => {
  it('renders a parsed pair as "lat, lng"', () => {
    expect(getFieldType('location').format('fromGeo', '51.5,-0.1')).toBe('51.5, -0.1');
  });

  it('returns null for unparseable values', () => {
    expect(getFieldType('location').format('fromGeo', '')).toBeNull();
    expect(getFieldType('location').format('fromGeo', 'nope')).toBeNull();
    expect(getFieldType('location').format('fromGeo', null)).toBeNull();
  });
});

describe('location field type', () => {
  const schema = getFieldType('location').schema();

  it('is writable to any string column', () => {
    expect(getFieldType('location').columns).toEqual([
      'note',
      'title',
      'description',
      'text',
      'unit',
      'from',
      'to',
      'fromGeo',
      'toGeo',
    ]);
  });

  it('accepts a valid "lat,lng" string', () => {
    expect(schema.safeParse('51.5,-0.1').success).toBe(true);
    expect(schema.safeParse('40, -74').success).toBe(true);
  });

  it('rejects malformed strings', () => {
    expect(schema.safeParse('51.5').success).toBe(false);
    expect(schema.safeParse('a,b').success).toBe(false);
    expect(schema.safeParse('').success).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(schema.safeParse('200,200').success).toBe(false);
    expect(schema.safeParse('91,0').success).toBe(false);
  });
});
