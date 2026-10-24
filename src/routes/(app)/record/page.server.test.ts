import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { addType } from '$lib/server/repos/types';
import { actions, load } from './+page.server';
import { load as layoutLoad } from './+layout.server';

async function makeUser() {
  return prisma.user.create({
    data: { username: `u-${Date.now()}-${Math.random()}`, name: 'Tester' },
  });
}

function loadEvent(url: string, user: { id: string }) {
  return {
    url: new URL(url, 'http://localhost'),
    locals: { user },
  } as never;
}

function postEvent(url: string, user: { id: string }, form: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) fd.set(k, v);
  return {
    url: new URL(url, 'http://localhost'),
    locals: { user },
    request: new Request('http://localhost' + url, { method: 'POST', body: fd }),
  } as never;
}

describe('/record load', () => {
  it('returns nulls when no ?type= query param is present', async () => {
    const user = await makeUser();
    const data = (await load(loadEvent('/record', user))) as {
      form: unknown;
      layout: unknown;
      typeId: unknown;
    };
    expect(data).toEqual({ form: null, layout: null, typeId: null });
  });

  it('returns form + layout when ?type= points to a type with fields', async () => {
    const user = await makeUser();
    const type = await addType({
      code: 'WITH_LAYOUT',
      layout: {
        fields: [{ id: 'n', label: 'Note', kind: 'text', writeTo: 'note', defaultValue: 'hi' }],
      },
    });
    const data = (await load(loadEvent(`/record?type=${type.id}`, user))) as {
      form: { data: { note: string } };
      layout: { fields: unknown[] };
      typeId: string;
    };
    expect(data.typeId).toBe(type.id);
    expect(data.layout.fields.length).toBe(1);
    expect(data.form.data.note).toBe('hi');
  });

  it('returns relation options gated by the layout’s relation fields', async () => {
    const user = await makeUser();
    await prisma.user.create({
      data: { username: `opt-${Date.now()}-${Math.random()}`, name: 'Pickable' },
    });
    const type = await addType({
      code: 'RELOPTS',
      layout: {
        fields: [
          { id: 'a', label: 'Author', kind: 'user', writeTo: 'creatorId' },
          { id: 'r', label: 'Replies to', kind: 'record', writeTo: 'recordId' },
        ],
      },
    });
    await addType({ code: 'RELOPTS2', layout: { fields: [] } });
    const data = (await load(loadEvent(`/record?type=${type.id}`, user))) as {
      options: { users: { id: string }[]; records: { id: string }[] };
    };
    expect(data.options.users.length).toBeGreaterThan(0);
    // No records of this kind needed — any active record qualifies as a link target.
    expect(Array.isArray(data.options.records)).toBe(true);
  });

  it('omits user/record options for a plain layout', async () => {
    const user = await makeUser();
    const type = await addType({
      code: 'PLAINOPTS',
      layout: { fields: [{ id: 'n', label: 'Note', kind: 'text', writeTo: 'note' }] },
    });
    const data = (await load(loadEvent(`/record?type=${type.id}`, user))) as {
      options: { users: unknown[]; records: unknown[] };
    };
    expect(data.options.users).toEqual([]);
    expect(data.options.records).toEqual([]);
  });

  it('returns nulls when the type has an empty layout', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'EMPTY', layout: { fields: [] } });
    const data = (await load(loadEvent(`/record?type=${type.id}`, user))) as {
      form: unknown;
    };
    expect(data.form).toBeNull();
  });
});

describe('/record save action', () => {
  it('rejects when no type is selected', async () => {
    const user = await makeUser();
    const result = await actions.save(postEvent('/record', user, { note: 'x' }));
    expect((result as { status: number }).status).toBe(400);
  });

  it('persists a record under the type from the URL, ignoring form typeId override', async () => {
    const user = await makeUser();
    const realType = await addType({
      code: 'REAL',
      layout: { fields: [{ id: 'n', label: 'Note', kind: 'text', writeTo: 'note' }] },
    });
    const sneakyType = await addType({ code: 'SNEAKY', layout: { fields: [] } });
    await actions.save(
      postEvent(`/record?type=${realType.id}`, user, { note: 'hello', typeId: sneakyType.id }),
    );
    const records = await prisma.record.findMany({ where: { typeId: realType.id } });
    expect(records.length).toBe(1);
    expect(records[0].note).toBe('hello');
    const sneakyRecords = await prisma.record.findMany({ where: { typeId: sneakyType.id } });
    expect(sneakyRecords.length).toBe(0);
  });

  it('uses the form-selected creator over the logged-in user', async () => {
    const user = await makeUser();
    const chosen = await makeUser();
    const type = await addType({
      code: 'CREATORFIELD',
      layout: { fields: [{ id: 'c', label: 'Author', kind: 'user', writeTo: 'creatorId' }] },
    });
    await actions.save(postEvent(`/record?type=${type.id}`, user, { creatorId: chosen.id }));
    const records = await prisma.record.findMany({ where: { typeId: type.id } });
    expect(records.length).toBe(1);
    expect(records[0].creatorId).toBe(chosen.id);
  });

  it('links the selected projects on save', async () => {
    const user = await makeUser();
    const type = await addType({
      code: 'PJSAVE',
      layout: { fields: [{ id: 'n', label: 'Note', kind: 'text', writeTo: 'note' }] },
    });
    const p1 = await prisma.project.create({
      data: { code: `ps-${Date.now()}-${Math.random()}` },
    });
    const p2 = await prisma.project.create({
      data: { code: `pt-${Date.now()}-${Math.random()}` },
    });

    const url = `/record?type=${type.id}`;
    const fd = new FormData();
    fd.set('note', 'x');
    fd.append('projectIds', p1.id);
    fd.append('projectIds', p2.id);
    const event = {
      url: new URL(url, 'http://localhost'),
      locals: { user },
      request: new Request('http://localhost' + url, { method: 'POST', body: fd }),
    } as never;
    await actions.save(event);

    const records = await prisma.record.findMany({
      where: { typeId: type.id },
      include: { projects: true },
    });
    expect(records.length).toBe(1);
    expect(records[0].projects.map((pr) => pr.projectId).sort()).toEqual([p1.id, p2.id].sort());
  });

  it('rejects an unknown project id with a 400 instead of saving', async () => {
    const user = await makeUser();
    const type = await addType({
      code: 'PJBAD',
      layout: { fields: [{ id: 'n', label: 'Note', kind: 'text', writeTo: 'note' }] },
    });

    const url = `/record?type=${type.id}`;
    const fd = new FormData();
    fd.set('note', 'x');
    fd.append('projectIds', 'no-such-project');
    const event = {
      url: new URL(url, 'http://localhost'),
      locals: { user },
      request: new Request('http://localhost' + url, { method: 'POST', body: fd }),
    } as never;
    const result = await actions.save(event);

    expect((result as { status: number }).status).toBe(400);
    expect(await prisma.record.count({ where: { typeId: type.id } })).toBe(0);
  });

  it('defaults the creator to the logged-in user when the form omits one', async () => {
    const user = await makeUser();
    const type = await addType({
      code: 'NOCREATOR',
      layout: { fields: [{ id: 'n', label: 'Note', kind: 'text', writeTo: 'note' }] },
    });
    await actions.save(postEvent(`/record?type=${type.id}`, user, { note: 'x' }));
    const records = await prisma.record.findMany({ where: { typeId: type.id } });
    expect(records[0].creatorId).toBe(user.id);
  });
});

describe('/record auth', () => {
  it('load and save redirect unauthenticated callers to /login', async () => {
    const anon = { url: new URL('http://localhost/record'), locals: {} } as never;
    await expect(load(anon)).rejects.toMatchObject({ location: '/login' });
    await expect(actions.save(anon)).rejects.toMatchObject({ location: '/login' });
    await expect(layoutLoad(anon)).rejects.toMatchObject({ location: '/login' });
  });
});
