import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, prismaOwner } from '$lib/prisma';
import { runAs } from '$lib/server/db/context';
import { makeWorld, type World } from '$lib/server/db/rls.testutil';
import { listRecordHistory } from './history';

let w: World;
beforeEach(async () => {
  w = await makeWorld();
});

const edit = (userId: string, id: string, data: Record<string, unknown>) =>
  runAs(userId, () => prisma.record.update({ where: { id }, data }));
const history = (userId: string | null, id: string, opts?: { beforeId?: string; limit?: number }) =>
  runAs(userId, () => listRecordHistory(id, opts));

describe('listRecordHistory', () => {
  it('lists the record newest first with actor names, changed columns and new values', async () => {
    await edit(w.alice.id, w.r1.id, { title: 'second' });
    await edit(w.alice.id, w.r1.id, { title: 'third', note: 'n' });

    const page = await history(w.alice.id, w.r1.id);
    expect(page.entries.map((e) => [e.action, e.kind, e.actorName, e.changed.sort()])).toEqual([
      ['UPDATE', 'record', 'ALICE', ['note', 'title']],
      ['UPDATE', 'record', 'ALICE', ['title']],
    ]);
    expect(page.entries[0].values).toEqual({ title: 'third', note: 'n' });
    expect(page.nextBefore).toBeNull();
    expect(typeof page.entries[0].id).toBe('string');
    expect(Number(page.entries[0].id)).toBeGreaterThan(Number(page.entries[1].id));
  });

  it('shows a project link with the project code', async () => {
    await runAs(w.alice.id, () =>
      prisma.projectRecord.delete({
        where: { projectId_recordId: { projectId: w.project.id, recordId: w.r1.id } },
      }),
    );
    const page = await history(w.alice.id, w.r1.id);
    expect(page.entries).toMatchObject([
      { kind: 'link', action: 'DELETE', projectCode: 'P', actorName: 'ALICE' },
    ]);
  });

  it('is empty for a record the viewer cannot read, and for nobody', async () => {
    await edit(w.alice.id, w.r1.id, { title: 'second' });
    expect((await history(w.bob.id, w.r1.id)).entries).toEqual([]);
    expect((await history(null, w.r1.id)).entries).toEqual([]);
  });

  it('pages older entries with beforeId and reports the cursor only when a page is full', async () => {
    for (const t of ['a', 'b', 'c', 'd', 'e']) await edit(w.alice.id, w.r1.id, { title: t });

    const first = await history(w.alice.id, w.r1.id, { limit: 2 });
    expect(first.entries.map((e) => e.values.title)).toEqual(['e', 'd']);
    expect(first.nextBefore).toBe(first.entries[1].id);

    const second = await history(w.alice.id, w.r1.id, { limit: 2, beforeId: first.nextBefore! });
    expect(second.entries.map((e) => e.values.title)).toEqual(['c', 'b']);

    const third = await history(w.alice.id, w.r1.id, {
      limit: 2,
      beforeId: second.nextBefore!,
    });
    expect(third.entries.map((e) => e.values.title)).toEqual(['a']);
    expect(third.nextBefore).toBeNull();
  });

  it('shows a non-admin nothing from the period the record was hidden; the admin sees it all', async () => {
    await edit(w.admin.id, w.rh.id, { title: 'while hidden' });
    // Rh is hidden: alice cannot even read it, so the door yields nothing for her ...
    expect((await history(w.alice.id, w.rh.id)).entries).toEqual([]);
    // ... and the admin sees the change.
    const adm = await history(w.admin.id, w.rh.id);
    expect(adm.entries.map((e) => e.values.title)).toContain('while hidden');

    // Un-hide it as admin: alice reads the record again but still not the hidden period.
    await edit(w.admin.id, w.rh.id, { hidden: false });
    await edit(w.alice.id, w.rh.id, { title: 'visible now' });
    const alice = await history(w.alice.id, w.rh.id);
    expect(alice.entries.map((e) => e.values.title)).toEqual(['visible now']);
  });

  it('shows the redaction row to an admin only', async () => {
    await edit(w.alice.id, w.r1.id, { title: 'secret' });
    await runAs(
      w.admin.id,
      () => prisma.$executeRaw`SELECT lit_history_redact(${w.r1.id}, ARRAY['title'])`,
    );

    const adm = await history(w.admin.id, w.r1.id);
    expect(adm.entries[0]).toMatchObject({
      action: 'REDACT',
      kind: 'record',
      actorName: 'ADMIN',
      changed: ['title'],
    });
    const alice = await history(w.alice.id, w.r1.id);
    expect(alice.entries.map((e) => e.action)).not.toContain('REDACT');
  });

  it('names an actor that was deleted as null', async () => {
    const temp = await prismaOwner.user.create({
      data: { username: 'temp', name: 'TEMP', isAdmin: true },
    });
    await edit(temp.id, w.r1.id, { title: 'temp edit' });
    await prismaOwner.user.delete({ where: { id: temp.id } });
    const page = await history(w.admin.id, w.r1.id);
    expect(page.entries).toMatchObject([{ actorName: null, values: { title: 'temp edit' } }]);
  });
});
