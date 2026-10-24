import { describe, expect, it } from 'vitest';
import {
  listRecordsOptions,
  parseRecordListQuery,
  projectRecordRows,
  recordListParams,
} from './listQuery';

describe('parseRecordListQuery', () => {
  it('defaults to page 1, newest-first, no filters', () => {
    expect(parseRecordListQuery(new URL('http://x/data'))).toEqual({
      page: 1,
      includeDeleted: false,
      sort: 'new',
      typeId: null,
      correspondent: null,
    });
  });

  it('reads page, deleted, sort, type and correspondent off the query string', () => {
    const url = new URL(
      'http://x/data?page=3&deleted=1&sort=old&type=abc123&correspondent=%20Hume%20',
    );
    expect(parseRecordListQuery(url)).toEqual({
      page: 3,
      includeDeleted: true,
      sort: 'old',
      typeId: 'abc123',
      correspondent: 'Hume',
    });
  });

  it('falls back to page 1 for a non-positive or non-numeric page', () => {
    expect(parseRecordListQuery(new URL('http://x/data?page=0')).page).toBe(1);
    expect(parseRecordListQuery(new URL('http://x/data?page=nope')).page).toBe(1);
  });

  it('falls back to page 1 for fractional, overflowing or out-of-range pages', () => {
    for (const bad of ['1.5', '1e12', '1e21', '-3', '10001', 'Infinity', '']) {
      expect(parseRecordListQuery(new URL(`http://x/data?page=${bad}`)).page).toBe(1);
    }
    expect(parseRecordListQuery(new URL('http://x/data?page=10000')).page).toBe(10000);
  });

  it('caps the correspondent filter length', () => {
    const url = new URL(`http://x/data?correspondent=${'a'.repeat(500)}`);
    expect(parseRecordListQuery(url).correspondent).toHaveLength(100);
  });
});

describe('projectRecordRows', () => {
  it('parses each row type layout into a validated Layout', () => {
    const validLayout = {
      fields: [{ id: 'f1', label: 'Note', kind: 'text', writeTo: 'note' }],
    };
    const rows = [
      { id: '1', type: { id: 't1', layout: validLayout } },
      { id: '2', type: { id: 't2', layout: { not: 'a layout' } } },
    ];
    const projected = projectRecordRows(rows);
    expect(projected[0].type.layout).toEqual(validLayout);
    expect(projected[1].type.layout).toBeNull();
    // Non-type fields pass through untouched.
    expect(projected[0].id).toBe('1');
  });
});

describe('recordListParams / listRecordsOptions', () => {
  it('round-trips a parsed query through its params', () => {
    const query = {
      page: 4,
      includeDeleted: true,
      sort: 'old' as const,
      typeId: 'abc',
      correspondent: 'Hume',
    };
    const url = new URL(`http://x/data/records?${recordListParams(query)}`);
    expect(parseRecordListQuery(url)).toEqual(query);
  });

  it('omits default filters', () => {
    const query = parseRecordListQuery(new URL('http://x/data'));
    expect(recordListParams(query).toString()).toBe('page=1');
  });

  it('maps sort and an overriding type id onto listRecords options', () => {
    const query = parseRecordListQuery(new URL('http://x/data?sort=old&type=a'));
    expect(listRecordsOptions(query)).toMatchObject({ sortDir: 'asc', typeId: 'a' });
    expect(listRecordsOptions(query, null).typeId).toBeUndefined();
    expect(listRecordsOptions({ ...query, sort: 'new' }).sortDir).toBe('desc');
  });
});
