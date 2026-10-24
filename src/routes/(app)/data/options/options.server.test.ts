import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { addType } from '$lib/server/repos/types';
import { createRecord } from '$lib/server/repos/records';
import { GET } from './+server';

async function makeUser(name = 'Tester', status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
  return prisma.user.create({
    data: { username: `u-${Date.now()}-${Math.random()}`, name, status },
  });
}

function event(url: string, user: { id: string } | null) {
  return { url: new URL(url, 'http://localhost'), locals: { user } } as never;
}

interface Opt {
  id: string;
  label?: string;
  name?: string;
}
async function options(url: string, user: { id: string } | null): Promise<Opt[]> {
  const res = await GET(event(url, user));
  expect(res.status).toBe(200);
  return ((await res.json()) as { options: Opt[] }).options;
}

describe('/data/options', () => {
  it('answers 401 JSON (not a redirect) when signed out', async () => {
    const res = await GET(event('/data/options?kind=user', null));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('rejects an unknown kind with 400', async () => {
    const user = await makeUser();
    expect((await GET(event('/data/options?kind=project', user))).status).toBe(400);
    expect((await GET(event('/data/options', user))).status).toBe(400);
  });

  it('searches users by name, never returning inactive ones', async () => {
    const me = await makeUser('Searcher');
    const hit = await makeUser('Zelda Fitz');
    await makeUser('Zelda Gone', 'INACTIVE');
    await makeUser('Someone Else');

    const found = await options('/data/options?kind=user&q=zelda', me);
    expect(found.map((o) => o.id)).toEqual([hit.id]);
  });

  it('searches records, excludes the current record and inactive ones', async () => {
    const me = await makeUser();
    const type = await addType({ code: 'OPT1' });
    const self = await createRecord({ typeId: type.id, note: 'needle self' });
    const other = await createRecord({ typeId: type.id, note: 'needle other' });
    const dead = await createRecord({ typeId: type.id, note: 'needle dead' });
    await prisma.record.update({ where: { id: dead.id }, data: { status: 'INACTIVE' } });

    const found = await options(`/data/options?kind=record&q=needle&exclude=${self.id}`, me);
    expect(found.map((o) => o.id)).toEqual([other.id]);
  });

  it('caps the result size at 20 whatever limit is asked for', async () => {
    const me = await makeUser();
    const type = await addType({ code: 'OPT2' });
    for (let i = 0; i < 25; i++) await createRecord({ typeId: type.id, note: `bulk ${i}` });

    expect(await options('/data/options?kind=record&limit=500', me)).toHaveLength(20);
    expect(await options('/data/options?kind=record&limit=3', me)).toHaveLength(3);
    expect(await options('/data/options?kind=record&limit=abc', me)).toHaveLength(20);
  });

  it('truncates an over-long query instead of failing', async () => {
    const me = await makeUser();
    const res = await GET(event(`/data/options?kind=user&q=${'a'.repeat(5000)}`, me));
    expect(res.status).toBe(200);
  });
});
