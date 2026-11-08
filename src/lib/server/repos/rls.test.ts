import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, prismaOwner } from '$lib/prisma';
import { runAs } from '$lib/server/db/context';
import { ForbiddenError } from '$lib/server/db/errors';
import { makeWorld, type World } from '$lib/server/db/rls.testutil';
import {
  createRecord,
  deleteRecord,
  getRecordById,
  listRecords,
  searchRecordOptions,
  updateRecord,
} from './records';
import { loadDashboardData } from './dashboard';
import { addType, countRecordsWithData, updateType } from './types';
import {
  LastAdminError,
  addMember,
  createGrant,
  createGroup,
  listGrants,
  updateUserAccess,
} from './admin';

// The repos exactly as the app runs them: scoped to a user, row-level security deciding.
let w: World;
beforeEach(async () => {
  vi.stubEnv('LIT_DB_OWNER_FALLBACK', '');
  w = await makeWorld();
});
afterEach(() => vi.unstubAllEnvs());

const titles = (rows: { title: string | null }[]) => rows.map((r) => r.title).sort();

describe('records follow row-level security', () => {
  it('lists, searches and opens only what the user may read', async () => {
    const asAlice = await runAs(w.alice.id, () => listRecords());
    expect(titles(asAlice.rows)).toEqual(['R1']);
    expect(asAlice.total).toBe(1);
    expect(titles((await runAs(w.bob.id, () => listRecords())).rows)).toEqual(['R2']);
    // hidden is admin-only; the admin sees everything
    expect(titles((await runAs(w.admin.id, () => listRecords())).rows)).toEqual(['R1', 'R2', 'Rh']);
    expect((await runAs(w.alice.id, () => searchRecordOptions({ q: 'R' }))).length).toBe(1);

    expect(await runAs(w.bob.id, () => getRecordById(w.r1.id))).toBeNull();
    expect(await runAs(w.alice.id, () => getRecordById(w.rh.id))).toBeNull();
    expect(await runAs(null, () => getRecordById(w.r1.id))).toBeNull();
  });

  it('shows amounts to those whose access path shows them, and masks them (distinct from empty) otherwise', async () => {
    const own = await runAs(w.alice.id, () => getRecordById(w.r1.id));
    expect(own).toMatchObject({
      sum: 100,
      hours: 2,
      total: 120,
      amountsMasked: false,
      canWrite: true,
    });
    const viaGrant = await runAs(w.dora.id, () => getRecordById(w.r2.id));
    expect(viaGrant).toMatchObject({
      sum: null,
      hours: null,
      total: null,
      amountsMasked: true,
      canWrite: false,
    });
    // an empty amount the user may see is NOT masked
    const empty = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.dora.id, title: 'empty' },
    });
    expect(await runAs(w.dora.id, () => getRecordById(empty.id))).toMatchObject({
      sum: null,
      amountsMasked: false,
    });
    const list = await runAs(w.dora.id, () => listRecords());
    expect(list.rows.find((r) => r.id === w.r2.id)?.amountsMasked).toBe(true);
  });

  it('refuses edits and deletes by readers and strangers with ForbiddenError, never a raw failure', async () => {
    await expect(
      runAs(w.dora.id, () => updateRecord(w.r2.id, { title: 'x' })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      runAs(w.bob.id, () => updateRecord(w.r1.id, { title: 'x' })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(runAs(w.dora.id, () => deleteRecord(w.r2.id))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(runAs(w.bob.id, () => deleteRecord(w.r1.id))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(runAs(null, () => deleteRecord(w.r1.id))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prismaOwner.record.count()).toBe(3);
  });

  it('a writer edits and hard-deletes; links go with the record', async () => {
    const saved = await runAs(w.alice.id, () =>
      updateRecord(w.r1.id, { title: 'R1b', sum: 7, projectIds: [] }),
    );
    expect(saved).toMatchObject({ title: 'R1b', sum: 7, amountsMasked: false });
    await runAs(w.alice.id, () => updateRecord(w.r1.id, { projectIds: [w.project.id] }));
    await runAs(w.alice.id, () => deleteRecord(w.r1.id));
    expect(await prismaOwner.record.count({ where: { id: w.r1.id } })).toBe(0);
    expect(await prismaOwner.projectRecord.count()).toBe(0);
  });

  it('an editor who cannot see the amounts saves the rest and never overwrites them', async () => {
    await prismaOwner.grant.create({
      data: { userId: w.dora.id, recordId: w.r2.id, level: 'WRITE', hideAmounts: true },
    });
    const out = await runAs(w.dora.id, () =>
      updateRecord(w.r2.id, { title: 'R2b', sum: 999, total: null }),
    );
    expect(out).toMatchObject({ title: 'R2b', amountsMasked: true, sum: null });
    const row = await prismaOwner.record.findUniqueOrThrow({
      where: { id: w.r2.id },
      omit: { sum: false, total: false },
    });
    expect(Number(row.sum)).toBe(50);
    expect(Number(row.total)).toBe(55);
  });

  it('only an admin changes the creator, and a non-admin cannot create a record for someone else', async () => {
    await expect(
      runAs(w.alice.id, () => updateRecord(w.r1.id, { creatorId: w.bob.id })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      runAs(w.alice.id, () => createRecord({ typeId: w.type.id, creatorId: w.bob.id })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const ok = await runAs(w.alice.id, () =>
      createRecord({
        typeId: w.type.id,
        creatorId: w.alice.id,
        title: 'mine',
        sum: 5,
        projectIds: [w.project.id],
      }),
    );
    expect(ok).toMatchObject({ title: 'mine', sum: 5, canWrite: true });
    await runAs(w.admin.id, () => updateRecord(w.r1.id, { creatorId: w.bob.id }));
    expect((await prismaOwner.record.findUniqueOrThrow({ where: { id: w.r1.id } })).creatorId).toBe(
      w.bob.id,
    );
  });
});

describe('dashboard, types and amounts', () => {
  it("counts and money cover only the signed-in user's readable records", async () => {
    const d = await runAs(w.alice.id, () => loadDashboardData(w.alice));
    expect(d.total).toBe(1);
    expect(d.money[0]).toMatchObject({ sum: 100, total: 120, count: 1 });
    expect(d.records[0]).toMatchObject({ sum: 100, hours: 2, total: 120 });
    // dora reaches R2 through a hiding grant, but it is not hers: dashboards are own records
    expect((await runAs(w.dora.id, () => loadDashboardData(w.dora))).total).toBe(0);
  });

  it('types are admin-write only; everyone active reads them', async () => {
    expect((await runAs(w.bob.id, () => prisma.type.findMany())).length).toBe(1);
    await expect(runAs(w.bob.id, () => addType({ code: 'nope' }))).rejects.toThrow();
    // a non-admin update is filtered out by the policy: not found, never a 500
    expect(await runAs(w.bob.id, () => updateType(w.type.id, { code: 'renamed' }))).toBeNull();
    await runAs(w.admin.id, () => addType({ code: 'ok' }));
    expect(await prismaOwner.type.count()).toBe(2);
  });

  it('per-column data counts read amounts through the view (admin)', async () => {
    const counts = await runAs(w.admin.id, () => countRecordsWithData(w.type.id));
    expect(counts.sum).toBe(3);
    expect(counts.total).toBe(2);
    expect(counts.hours).toBe(1);
  });
});

describe('admin repos', () => {
  it('refuse a non-admin, and the last active admin cannot be demoted or deactivated', async () => {
    await expect(
      runAs(w.alice.id, () => createGroup({ name: 'g', description: null })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    // the policy filters the row out: indistinguishable from a missing one
    await expect(
      runAs(w.alice.id, () => updateUserAccess(w.bob.id, { isAdmin: true, status: 'ACTIVE' })),
    ).rejects.toThrow();

    await expect(
      runAs(w.admin.id, () => updateUserAccess(w.admin.id, { isAdmin: false, status: 'ACTIVE' })),
    ).rejects.toBeInstanceOf(LastAdminError);
    await expect(
      runAs(w.admin.id, () => updateUserAccess(w.admin.id, { isAdmin: true, status: 'INACTIVE' })),
    ).rejects.toBeInstanceOf(LastAdminError);
    // with a second admin the first may step down
    await runAs(w.admin.id, () => updateUserAccess(w.bob.id, { isAdmin: true, status: 'ACTIVE' }));
    await runAs(w.admin.id, () =>
      updateUserAccess(w.admin.id, { isAdmin: false, status: 'ACTIVE' }),
    );
    await expect(
      runAs(w.bob.id, () => updateUserAccess(w.bob.id, { isAdmin: false, status: 'ACTIVE' })),
    ).rejects.toBeInstanceOf(LastAdminError);
  });

  it('groups, memberships and grants work end to end and change what users see', async () => {
    const group = await runAs(w.admin.id, () =>
      createGroup({ name: 'readers', description: null }),
    );
    await runAs(w.admin.id, () => addMember(group.id, w.bob.id));
    expect(titles((await runAs(w.bob.id, () => listRecords())).rows)).toEqual(['R2']);
    await runAs(w.admin.id, () =>
      createGrant({
        target: { kind: 'group', id: group.id },
        scope: { kind: 'type', id: w.type.id },
        level: 'READ',
        hideAmounts: false,
      }),
    );
    expect(titles((await runAs(w.bob.id, () => listRecords())).rows)).toEqual(['R1', 'R2']);
    // the grants a user can list are their own rows only
    expect((await runAs(w.bob.id, () => listGrants())).length).toBe(1);
    expect((await runAs(w.admin.id, () => listGrants())).length).toBe(2);
  });
});
