import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { addType } from '$lib/server/repos/types';
import { createRecord } from '$lib/server/repos/records';
import { GET } from './+server';

async function makeUser() {
  return prisma.user.create({
    data: { username: `u-${Date.now()}-${Math.random()}`, name: 'Tester' },
  });
}

function event(url: string, user: { id: string } | null) {
  return { url: new URL(url, 'http://localhost'), locals: { user } } as never;
}

describe('/data/records', () => {
  it('answers 401 JSON (not a redirect) when signed out', async () => {
    const res = await GET(event('/data/records', null));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns the requested page of rows with paging metadata', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'API1' });
    await createRecord({ typeId: type.id, note: 'a' });
    await createRecord({ typeId: type.id, note: 'b' });

    const res = await GET(event('/data/records?page=1', user));
    const body = (await res.json()) as { rows: { note: string }[]; total: number; page: number };
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.rows).toHaveLength(2);
  });

  it('treats a malformed page param as page 1 instead of failing', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'API2' });
    await createRecord({ typeId: type.id, note: 'a' });

    for (const bad of ['1.5', '1e21', '-1']) {
      const res = await GET(event(`/data/records?page=${bad}`, user));
      expect(res.status).toBe(200);
      expect(((await res.json()) as { page: number }).page).toBe(1);
    }
  });
});
