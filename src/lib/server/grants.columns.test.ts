import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';

// Every column of lit_record other than the three amounts must be readable by the restricted
// roles (the amounts only through view lit_record_amount). A new column without
// `GRANT SELECT (col) ON lit_record TO lit_app, lit_gateway` fails here, not in production.
const AMOUNTS = ['sum', 'hours', 'total'];

describe('lit_record column privileges', () => {
  it('grants SELECT on every non-amount column and none on the amounts', async () => {
    const cols = await prisma.$queryRaw<
      { column_name: string; app: boolean; gw: boolean }[]
    >`select column_name,
             has_column_privilege('lit_app', 'lit_record', column_name, 'SELECT') as app,
             has_column_privilege('lit_gateway', 'lit_record', column_name, 'SELECT') as gw
      from information_schema.columns
      where table_schema = 'public' and table_name = 'lit_record'`;
    expect(cols.length).toBeGreaterThan(10);
    for (const c of cols) {
      const amount = AMOUNTS.includes(c.column_name);
      expect({ col: c.column_name, app: c.app, gw: c.gw }).toEqual({
        col: c.column_name,
        app: !amount,
        gw: !amount,
      });
    }
  });
});

describe('lit_record_mention privileges', () => {
  it('gives the app SELECT, INSERT and DELETE, the gateway SELECT, and nobody UPDATE', async () => {
    const [p] = await prisma.$queryRaw<Record<string, boolean>[]>`select
      has_table_privilege('lit_app', 'lit_record_mention', 'SELECT') as app_select,
      has_table_privilege('lit_app', 'lit_record_mention', 'INSERT') as app_insert,
      has_table_privilege('lit_app', 'lit_record_mention', 'DELETE') as app_delete,
      has_table_privilege('lit_app', 'lit_record_mention', 'UPDATE') as app_update,
      has_table_privilege('lit_gateway', 'lit_record_mention', 'SELECT') as gw_select,
      has_table_privilege('lit_gateway', 'lit_record_mention', 'INSERT') as gw_insert,
      has_table_privilege('lit_gateway', 'lit_record_mention', 'UPDATE') as gw_update,
      has_table_privilege('lit_gateway', 'lit_record_mention', 'DELETE') as gw_delete`;
    expect(p).toEqual({
      app_select: true,
      app_insert: true,
      app_delete: true,
      app_update: false,
      gw_select: true,
      gw_insert: false,
      gw_update: false,
      gw_delete: false,
    });
  });
});
