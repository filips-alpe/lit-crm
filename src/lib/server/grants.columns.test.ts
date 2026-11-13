import { describe, expect, it } from 'vitest';
import { prisma, prismaOwner } from '$lib/prisma';
import { runAs } from '$lib/server/db/context';
import { makeWorld } from '$lib/server/db/rls.testutil';

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

describe('history snapshot allow-list', () => {
  // The history reader shows a non-admin only the keys (and changed names) of the columns the
  // app role may SELECT, plus the amounts when the reader may see them: a column that is not
  // granted today, or that a later migration leaves ungranted, never reaches history readers.
  const read = (uid: string, recordId: string) =>
    runAs(
      uid,
      () =>
        prisma.$queryRaw<
          { data: Record<string, unknown>; changed: string[] | null }[]
        >`SELECT data, changed FROM lit_record_history(${recordId})`,
    );

  it('shows exactly the granted columns of lit_record, and the amounts only to amount readers', async () => {
    const w = await makeWorld();
    await runAs(w.bob.id, () =>
      prisma.record.update({ where: { id: w.r2.id }, data: { sum: 60 } }),
    );
    await runAs(w.bob.id, () =>
      prisma.record.update({ where: { id: w.r2.id }, data: { title: 't' } }),
    );
    const granted = (
      await prismaOwner.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'lit_record'
          AND has_column_privilege('lit_app', 'lit_record', column_name, 'SELECT')`
    ).map((c) => c.column_name);
    const masked = await read(w.dora.id, w.r2.id); // READ grant, amounts hidden
    expect(masked).toHaveLength(1); // the sum-only edit is invisible to her
    expect(Object.keys(masked[0].data).sort()).toEqual([...granted].sort());
    const creator = await read(w.bob.id, w.r2.id);
    expect(Object.keys(creator[0].data).sort()).toEqual([...granted, ...AMOUNTS].sort());
  });

  it('follows a column grant: a revoked column vanishes from data and changed, for non-admins only', async () => {
    const w = await makeWorld();
    await runAs(w.alice.id, () =>
      prisma.record.update({ where: { id: w.r1.id }, data: { note: 'private', title: 'public' } }),
    );
    await prismaOwner.$executeRawUnsafe('REVOKE SELECT (note) ON lit_record FROM lit_app');
    try {
      const [row] = await read(w.alice.id, w.r1.id);
      expect(row.data).not.toHaveProperty('note');
      expect(row.data).toHaveProperty('title', 'public');
      expect(row.changed).toEqual(['title']);
      const [adminRow] = await read(w.admin.id, w.r1.id);
      expect(adminRow.data).toHaveProperty('note', 'private');
      expect(adminRow.changed).toEqual(['note', 'title']);
    } finally {
      await prismaOwner.$executeRawUnsafe('GRANT SELECT (note) ON lit_record TO lit_app');
    }
  });
});
