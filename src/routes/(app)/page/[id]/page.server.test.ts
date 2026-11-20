import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { addType } from '$lib/server/repos/types';
import { createRecord } from '$lib/server/repos/records';
import { runAs } from '$lib/server/db/context';
import { load } from './+page.server';

async function makeUser() {
  return prisma.user.create({
    data: { username: `u-${Date.now()}-${Math.random()}`, name: 'Tester' },
  });
}
const event = (id: string, user: { id: string } | null) =>
  ({ url: new URL(`/page/${id}`, 'http://localhost'), params: { id }, locals: { user } }) as never;

describe('/page/[id] load', () => {
  it('404s for an unknown record', async () => {
    const user = await makeUser();
    await expect(load(event('nope', user))).rejects.toMatchObject({ status: 404 });
  });

  it('redirects a signed-out visitor to login', async () => {
    await expect(load(event('x', null))).rejects.toMatchObject({ status: 303 });
  });

  it('returns a plain, serializable best page for any record', async () => {
    const user = await prisma.user.create({
      data: { username: `a-${Date.now()}-${Math.random()}`, name: 'Admin', isAdmin: true },
    });
    const type = await addType({
      code: 'L1',
      layout: {
        fields: [
          { id: 't', label: 'Title', kind: 'text', writeTo: 'title' },
          { id: 'b', label: 'Body', kind: 'text', writeTo: 'text' },
        ],
      },
    });
    const rec = await runAs(user.id, () => createRecord({ typeId: type.id }));
    await runAs(user.id, () =>
      prisma.record.update({
        where: { id: rec.id },
        data: { title: 'A letter', text: 'Dear Sir' },
      }),
    );
    const data = (await runAs(user.id, async () => await load(event(rec.id, user)))) as {
      page: { record: { title: string }; sections: { kind: string }[] };
    };
    expect(data.page.record.title).toBe('A letter');
    expect(data.page.sections.map((s) => s.kind)).toEqual(['text']);
    const withHistory = data as unknown as {
      history: { entries: { action: string }[]; nextBefore: string | null };
      layout: { fields: unknown[] };
    };
    expect(withHistory.history.entries.map((e) => e.action)).toEqual(['UPDATE', 'INSERT']);
    expect(withHistory.history.nextBefore).toBeNull();
    expect(withHistory.layout.fields).toHaveLength(2);
    expect(JSON.parse(JSON.stringify(data.page))).toEqual(data.page);
  });
});
