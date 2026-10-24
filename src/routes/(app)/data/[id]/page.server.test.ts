import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import { addType } from '$lib/server/repos/types';
import { createRecord, getRecordById } from '$lib/server/repos/records';
import { actions, load } from './+page.server';

const textLayout = {
  fields: [
    { id: 't', label: 'Title', kind: 'text' as const, writeTo: 'title' },
    { id: 'b', label: 'Body', kind: 'text' as const, writeTo: 'text' },
  ],
};

const letterLayout = {
  fields: [
    { id: 't', label: 'Title', kind: 'text' as const, writeTo: 'title' },
    { id: 'b', label: 'Body', kind: 'text' as const, writeTo: 'text' },
    { id: 'fg', label: 'From coords', kind: 'location' as const, writeTo: 'fromGeo' },
  ],
};

async function makeUser() {
  return prisma.user.create({
    data: { username: `u-${Date.now()}-${Math.random()}`, name: 'Tester' },
  });
}

function loadEvent(url: string, id: string, user: { id: string }) {
  return { url: new URL(url, 'http://localhost'), params: { id }, locals: { user } } as never;
}

function postEvent(url: string, id: string, user: { id: string }, form: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) fd.set(k, v);
  return {
    url: new URL(url, 'http://localhost'),
    params: { id },
    locals: { user },
    request: new Request('http://localhost' + url, { method: 'POST', body: fd }),
  } as never;
}

describe('/data/[id] load', () => {
  it('404s for an unknown record', async () => {
    const user = await makeUser();
    await expect(load(loadEvent('/data/nope', 'nope', user))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('seeds the edit form from the record values', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'L1', layout: textLayout });
    const rec = await createRecord({ typeId: type.id, note: 'n' });
    await prisma.record.update({
      where: { id: rec.id },
      data: { title: 'Seeded', text: 'Body here' },
    });

    const data = (await load(loadEvent(`/data/${rec.id}`, rec.id, user))) as {
      form: { data: { title: string; text: string } };
      type: { id: string };
    };
    expect(data.type.id).toBe(type.id);
    expect(data.form.data.title).toBe('Seeded');
    expect(data.form.data.text).toBe('Body here');
  });

  it('ships labels only for the relations the record already holds, not the whole lists', async () => {
    const user = await makeUser();
    const bystander = await makeUser();
    const type = await addType({
      code: 'DOPTS',
      layout: {
        fields: [
          { id: 'a', label: 'Author', kind: 'user', writeTo: 'creatorId' },
          { id: 'r', label: 'Replies to', kind: 'record', writeTo: 'recordId' },
        ],
      },
    });
    const other = await createRecord({ typeId: type.id, note: 'other' });
    const unrelated = await createRecord({ typeId: type.id, note: 'unrelated' });
    const rec = await createRecord({
      typeId: type.id,
      note: 'self',
      creatorId: user.id,
      recordId: other.id,
    });

    const data = (await load(loadEvent(`/data/${rec.id}`, rec.id, user))) as {
      options: {
        users: { id: string }[];
        records: { id: string }[];
        excludeRecordId: string;
      };
    };
    expect(data.options.users.map((u) => u.id)).toEqual([user.id]);
    expect(data.options.users.map((u) => u.id)).not.toContain(bystander.id);
    expect(data.options.records.map((r) => r.id)).toEqual([other.id]);
    expect(data.options.records.map((r) => r.id)).not.toContain(unrelated.id);
    expect(data.options.excludeRecordId).toBe(rec.id);
  });

  it('seeds projectIds from the record’s project membership', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'PSEED', layout: textLayout });
    const p1 = await prisma.project.create({
      data: { code: `ps-${Date.now()}-${Math.random()}` },
    });
    const rec = await createRecord({ typeId: type.id, note: 'n', projectIds: [p1.id] });

    const data = (await load(loadEvent(`/data/${rec.id}`, rec.id, user))) as {
      form: { data: { projectIds: string[] } };
    };
    expect(data.form.data.projectIds).toEqual([p1.id]);
  });

  it('returns the correspondence thread (from↔to stack) for a letter', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'L2', layout: textLayout });
    // A Franklin↔Collinson thread (both directions) plus an unrelated letter.
    const l1 = await createRecord({ typeId: type.id, note: '1' });
    const l2 = await createRecord({ typeId: type.id, note: '2' });
    const l3 = await createRecord({ typeId: type.id, note: '3' });
    const other = await createRecord({ typeId: type.id, note: 'x' });
    await prisma.record.update({
      where: { id: l1.id },
      data: { from: 'Franklin', to: 'Collinson', createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    await prisma.record.update({
      where: { id: l2.id },
      data: { from: 'Collinson', to: 'Franklin', createdAt: new Date('2026-02-01T00:00:00Z') },
    });
    await prisma.record.update({
      where: { id: l3.id },
      data: { from: 'Franklin', to: 'Collinson', createdAt: new Date('2026-03-01T00:00:00Z') },
    });
    await prisma.record.update({
      where: { id: other.id },
      data: { from: 'Franklin', to: 'Hume' },
    });

    const data = (await load(loadEvent(`/data/${l2.id}`, l2.id, user))) as {
      thread: { prevId: string | null; nextId: string | null; position: number; total: number };
    };
    expect(data.thread).toEqual({ prevId: l1.id, nextId: l3.id, position: 2, total: 3 });
  });

  it('returns the plottable correspondence (geo-bearing letters of the type) for a located type', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'L2c', layout: letterLayout });
    const here = await createRecord({ typeId: type.id, note: 'here' });
    const other = await createRecord({ typeId: type.id, note: 'other' });
    const noGeo = await createRecord({ typeId: type.id, note: 'no-geo' });
    await prisma.record.update({ where: { id: here.id }, data: { fromGeo: '51.5,-0.1' } });
    await prisma.record.update({ where: { id: other.id }, data: { fromGeo: '40,-75' } });

    const data = (await load(loadEvent(`/data/${here.id}`, here.id, user))) as {
      letters: { id: string }[];
    };
    const ids = data.letters.map((l) => l.id);
    expect(ids).toContain(here.id);
    expect(ids).toContain(other.id);
    expect(ids).not.toContain(noGeo.id);
  });

  it('returns no map letters for a type without a location field', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'L2d', layout: textLayout });
    const rec = await createRecord({ typeId: type.id, note: 'plain' });

    const data = (await load(loadEvent(`/data/${rec.id}`, rec.id, user))) as {
      letters: unknown[];
    };
    expect(data.letters).toEqual([]);
  });

  it('returns an empty thread for a record without both endpoints', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'L2b', layout: textLayout });
    const rec = await createRecord({ typeId: type.id, note: 'no-endpoints' });

    const data = (await load(loadEvent(`/data/${rec.id}`, rec.id, user))) as {
      thread: { prevId: string | null; nextId: string | null; position: number; total: number };
    };
    expect(data.thread).toEqual({ prevId: null, nextId: null, position: 0, total: 0 });
  });
});

describe('/data/[id] save action', () => {
  it('persists edited field values', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'L3', layout: textLayout });
    const rec = await createRecord({ typeId: type.id, note: 'n' });

    await actions.save(
      postEvent(`/data/${rec.id}`, rec.id, user, { title: 'Edited', text: 'New body' }),
    );

    const after = await getRecordById(rec.id);
    expect(after?.title).toBe('Edited');
    expect(after?.text).toBe('New body');
  });

  it('rejects an unknown or inactive project id with a 400 field error, not a 500', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'PJBAD', layout: textLayout });
    const inactive = await prisma.project.create({
      data: { code: `pi-${Date.now()}-${Math.random()}`, status: 'INACTIVE' },
    });
    const rec = await createRecord({ typeId: type.id, note: 'n' });

    for (const bad of ['no-such-project', inactive.id]) {
      const url = `/data/${rec.id}`;
      const fd = new FormData();
      fd.set('title', 'T');
      fd.append('projectIds', bad);
      const result = (await actions.save({
        url: new URL(url, 'http://localhost'),
        params: { id: rec.id },
        locals: { user },
        request: new Request('http://localhost' + url, { method: 'POST', body: fd }),
      } as never)) as { status: number; data: { form: { errors: { projectIds?: unknown } } } };
      expect(result.status).toBe(400);
      expect(result.data.form.errors.projectIds).toBeDefined();
    }
  });

  it('replaces the project membership on save', async () => {
    const user = await makeUser();
    const type = await addType({ code: 'PJUPD', layout: textLayout });
    const p1 = await prisma.project.create({
      data: { code: `u1-${Date.now()}-${Math.random()}` },
    });
    const p2 = await prisma.project.create({
      data: { code: `u2-${Date.now()}-${Math.random()}` },
    });
    const rec = await createRecord({ typeId: type.id, note: 'n', projectIds: [p1.id] });

    const url = `/data/${rec.id}`;
    const fd = new FormData();
    fd.set('title', 'T');
    fd.append('projectIds', p2.id);
    const event = {
      url: new URL(url, 'http://localhost'),
      params: { id: rec.id },
      locals: { user },
      request: new Request('http://localhost' + url, { method: 'POST', body: fd }),
    } as never;
    await actions.save(event);

    const links = await prisma.projectRecord.findMany({ where: { recordId: rec.id } });
    expect(links.map((l) => l.projectId)).toEqual([p2.id]);
  });

  it('404s when saving an unknown record', async () => {
    const user = await makeUser();
    await expect(
      actions.save(postEvent('/data/nope', 'nope', user, { title: 'x' })),
    ).rejects.toMatchObject({ status: 404 });
  });
});
