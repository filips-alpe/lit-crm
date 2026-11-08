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
