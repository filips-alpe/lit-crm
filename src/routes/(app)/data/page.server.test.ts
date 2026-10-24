import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { addType } from '$lib/server/repos/types';
import { createRecord } from '$lib/server/repos/records';
import { load } from './+page.server';

function event(url: string) {
  return { url: new URL(url, 'http://localhost'), locals: { user: { id: 'u1' } } } as never;
}

describe('/data load', () => {
  it('returns ACTIVE rows on page 1 by default, newest first', async () => {
    const type = await addType({ code: 'D1' });
    await createRecord({ typeId: type.id, note: 'a' });
    const dead = await createRecord({ typeId: type.id, note: 'gone' });
    await prisma.record.update({ where: { id: dead.id }, data: { status: 'INACTIVE' } });

    const data = (await load(event('/data'))) as {
      rows: { note: string }[];
      total: number;
      page: number;
      sort: string;
      includeDeleted: boolean;
    };
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.sort).toBe('new');
    expect(data.includeDeleted).toBe(false);
    expect(data.rows.map((r) => r.note)).toEqual(['a']);
  });

  it('?correspondent=X filters to records whose to/from match, and reports the filter', async () => {
    const type = await addType({
      code: 'DC',
      layout: { fields: [{ id: 'to', label: 'To', kind: 'text', writeTo: 'to' }] },
    });
    const hit = await createRecord({ typeId: type.id, note: 'to-hume' });
    const miss = await createRecord({ typeId: type.id, note: 'to-voltaire' });
    await prisma.record.update({ where: { id: hit.id }, data: { to: 'D. Hume' } });
    await prisma.record.update({ where: { id: miss.id }, data: { to: 'Voltaire' } });

    const data = (await load(event('/data?correspondent=hume'))) as {
      rows: { note: string }[];
      total: number;
      correspondentFilter: string | null;
    };
    expect(data.correspondentFilter).toBe('hume');
    expect(data.total).toBe(1);
    expect(data.rows.map((r) => r.note)).toEqual(['to-hume']);
  });

  it('orders by createdAt: newest first by default, oldest with ?sort=old', async () => {
    const type = await addType({ code: 'D2' });
    const older = await createRecord({ typeId: type.id, note: 'older' });
    const newer = await createRecord({ typeId: type.id, note: 'newer' });
    await prisma.record.update({
      where: { id: older.id },
      data: { createdAt: new Date('1700-01-01T00:00:00Z') },
    });
    await prisma.record.update({
      where: { id: newer.id },
      data: { createdAt: new Date('1800-01-01T00:00:00Z') },
    });

    const def = (await load(event('/data'))) as { sort: string; rows: { note: string }[] };
    expect(def.sort).toBe('new');
    expect(def.rows.map((r) => r.note)).toEqual(['newer', 'older']);

    const asc = (await load(event('/data?sort=old'))) as { sort: string; rows: { note: string }[] };
    expect(asc.sort).toBe('old');
    expect(asc.rows.map((r) => r.note)).toEqual(['older', 'newer']);
  });

  it('?deleted=1 includes INACTIVE rows', async () => {
    const type = await addType({ code: 'D3' });
    await createRecord({ typeId: type.id, note: 'live' });
    const dead = await createRecord({ typeId: type.id, note: 'dead' });
    await prisma.record.update({ where: { id: dead.id }, data: { status: 'INACTIVE' } });
    const data = (await load(event('/data?deleted=1'))) as {
      total: number;
      includeDeleted: boolean;
    };
    expect(data.includeDeleted).toBe(true);
    expect(data.total).toBe(2);
  });

  it('carries the record creator through to the loaded rows', async () => {
    const type = await addType({ code: 'DC1' });
    const user = await prisma.user.create({
      data: { username: `dc-${Date.now()}-${Math.random()}`, name: 'Creator' },
    });
    await createRecord({ typeId: type.id, note: 'mine', creatorId: user.id });

    const data = (await load(event('/data'))) as {
      rows: { creator: { username: string; name: string } | null }[];
    };
    expect(data.rows[0].creator).toMatchObject({ username: user.username, name: 'Creator' });
  });

  it('?page=2 returns the second page', async () => {
    const type = await addType({ code: 'D4' });
    for (let i = 0; i < 27; i++) {
      await createRecord({ typeId: type.id, note: `n${i}` });
    }
    const data = (await load(event('/data?page=2'))) as {
      page: number;
      rows: unknown[];
      total: number;
    };
    expect(data.page).toBe(2);
    expect(data.total).toBe(27);
    expect(data.rows.length).toBe(2);
  });
});

describe('/data load auth', () => {
  it('redirects an anonymous request to /login', async () => {
    await expect(
      load({ url: new URL('http://localhost/data'), locals: {} } as never),
    ).rejects.toMatchObject({ status: 303, location: '/login' });
  });
});
