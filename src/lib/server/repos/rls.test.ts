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

describe('delete with links the user cannot see', () => {
  it('a writer deletes a record whose link points at a project they cannot read', async () => {
    const hidden = await prismaOwner.project.create({ data: { code: 'Q', creatorId: w.bob.id } });
    await prismaOwner.projectRecord.create({ data: { projectId: hidden.id, recordId: w.r1.id } });
    // alice cannot read Q, so she cannot see or remove that link herself
    expect(await runAs(w.alice.id, () => prisma.projectRecord.count())).toBe(1);
    await runAs(w.alice.id, () => deleteRecord(w.r1.id));
    expect(await prismaOwner.record.count({ where: { id: w.r1.id } })).toBe(0);
    expect(await prismaOwner.projectRecord.count()).toBe(0);
    // the project side is unchanged: a project with records is not deletable
    await prismaOwner.projectRecord.create({ data: { projectId: hidden.id, recordId: w.r2.id } });
    await expect(prismaOwner.project.delete({ where: { id: hidden.id } })).rejects.toThrow();
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

  it('the database refuses removing the last admin even around the repo, and serialises concurrent demotions', async () => {
    await expect(
      runAs(w.admin.id, () =>
        prisma.user.update({ where: { id: w.admin.id }, data: { isAdmin: false } }),
      ),
    ).rejects.toThrow(/last active admin/);
    await expect(
      runAs(w.admin.id, () =>
        prisma.user.update({ where: { id: w.admin.id }, data: { status: 'INACTIVE' } }),
      ),
    ).rejects.toThrow(/last active admin/);
    // the owner (migrations, fixtures) is not restricted
    await prismaOwner.user.update({ where: { id: w.admin.id }, data: { isAdmin: true } });

    await prismaOwner.user.update({ where: { id: w.bob.id }, data: { isAdmin: true } });
    for (let round = 0; round < 8; round++) {
      await prismaOwner.user.updateMany({
        where: { id: { in: [w.admin.id, w.bob.id] } },
        data: { isAdmin: true, status: 'ACTIVE' },
      });
      // both pass the early check (the other is still an admin); the trigger lets exactly one through
      const results = await Promise.allSettled([
        runAs(w.admin.id, () => updateUserAccess(w.admin.id, { isAdmin: false, status: 'ACTIVE' })),
        runAs(w.bob.id, () => updateUserAccess(w.bob.id, { isAdmin: false, status: 'ACTIVE' })),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(failed.reason).toBeInstanceOf(LastAdminError);
      expect(await prismaOwner.user.count({ where: { isAdmin: true, status: 'ACTIVE' } })).toBe(1);
    }
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

// Security review F1: a writer whose amounts are masked must not be able to learn them
// by writing guesses (success vs failure was an equality oracle).
describe('no amount oracle (F1)', () => {
  let carol: { id: string };
  beforeEach(async () => {
    carol = await prismaOwner.user.create({ data: { username: 'carol', name: 'CAROL' } });
    // WRITE on bob's record R2 (amounts 50 / total 55), amounts hidden
    await prismaOwner.grant.create({
      data: { userId: carol.id, recordId: w.r2.id, level: 'WRITE', hideAmounts: true },
    });
  });

  const guess = (col: 'sum' | 'hours' | 'total', v: number | null) =>
    runAs(carol.id, () =>
      prisma.$executeRawUnsafe(`UPDATE lit_record SET "${col}" = $1 WHERE id = $2`, v, w.r2.id),
    );

  it('raises for any UPDATE naming an amount column, right guess or wrong, even NULL', async () => {
    for (const v of [1, 50, 55, null]) {
      for (const col of ['sum', 'hours', 'total'] as const) {
        await expect(guess(col, v), `${col}=${v}`).rejects.toThrow(/amounts are hidden/);
      }
    }
    // brute force: not a single value gets through, so no value is ever confirmed
    let hits = 0;
    for (let g = 40; g <= 60; g++) {
      try {
        await guess('sum', g);
        hits++;
      } catch {
        /* denied */
      }
    }
    expect(hits).toBe(0);
    // the ON CONFLICT DO UPDATE door is shut too
    await expect(
      runAs(
        carol.id,
        () =>
          prisma.$executeRaw`INSERT INTO lit_record (id, "updatedAt", "typeId", "creatorId")
          VALUES (${w.r2.id}, now(), ${w.type.id}, ${carol.id})
          ON CONFLICT (id) DO UPDATE SET "sum" = 50`,
      ),
    ).rejects.toThrow();
    expect(
      Number((await prismaOwner.record.findUniqueOrThrow({ where: { id: w.r2.id } })).title),
    ).toBeNaN();
  });

  it('the masked writer can still edit everything else, and the app does not send amounts', async () => {
    const saved = await runAs(carol.id, () =>
      updateRecord(w.r2.id, { title: 'edited', sum: 999, hours: 9, total: 9 }),
    );
    expect(saved).toMatchObject({ title: 'edited', amountsMasked: true, sum: null });
    const [raw] = await prismaOwner.$queryRaw<{ sum: unknown; total: unknown }[]>`
      SELECT "sum", "total" FROM lit_record WHERE id = ${w.r2.id}`;
    expect([Number(raw.sum), Number(raw.total)]).toEqual([50, 55]);
  });

  it('unmasked writers (creator, admin, grant without hideAmounts) still write amounts', async () => {
    expect(await runAs(w.bob.id, () => updateRecord(w.r2.id, { sum: 51 }))).toMatchObject({
      sum: 51,
    });
    expect(await runAs(w.admin.id, () => updateRecord(w.r2.id, { sum: 52 }))).toMatchObject({
      sum: 52,
    });
    await prismaOwner.grant.updateMany({
      where: { userId: carol.id },
      data: { hideAmounts: false },
    });
    expect(await runAs(carol.id, () => updateRecord(w.r2.id, { sum: 53 }))).toMatchObject({
      sum: 53,
      amountsMasked: false,
    });
  });
});

// Security review F2: link changes need write on the record AND on the project.
describe('project links (F2)', () => {
  let eve: { id: string };
  let p2: { id: string };
  let mine: { id: string };
  beforeEach(async () => {
    eve = await prismaOwner.user.create({ data: { username: 'eve', name: 'EVE' } });
    p2 = await prismaOwner.project.create({ data: { code: 'P2', creatorId: w.alice.id } });
    mine = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: eve.id, title: 'mine' },
    });
  });
  const link = (userId: string, projectId: string, recordId: string) =>
    runAs(userId, () => prisma.projectRecord.create({ data: { projectId, recordId } }));
  const unlink = (userId: string, projectId: string, recordId: string) =>
    runAs(userId, () =>
      prisma.projectRecord.deleteMany({ where: { projectId, recordId } }).then((r) => r.count),
    );
  const grant = (level: 'READ' | 'WRITE') =>
    prismaOwner.grant.create({
      data: { userId: eve.id, projectId: w.project.id, level, hideAmounts: false },
    });

  it('a READ grant on the project is not enough to link or unlink', async () => {
    await grant('READ');
    await expect(link(eve.id, w.project.id, mine.id)).rejects.toThrow();
    // R1 is in P and readable to eve through the project; she cannot write it, so no unlink either
    expect(await unlink(eve.id, w.project.id, w.r1.id)).toBe(0);
    // the record's own writer, still with only READ on the project
    await prismaOwner.projectRecord.create({
      data: { projectId: w.project.id, recordId: mine.id },
    });
    expect(await unlink(eve.id, w.project.id, mine.id)).toBe(0);
    expect(await prismaOwner.projectRecord.count()).toBe(2);
  });

  it('a WRITE grant on the project plus write on the record may link and unlink', async () => {
    await grant('WRITE');
    await link(eve.id, w.project.id, mine.id);
    expect(await prismaOwner.projectRecord.count({ where: { recordId: mine.id } })).toBe(1);
    expect(await unlink(eve.id, w.project.id, mine.id)).toBe(1);
    // record write is still required: R1 belongs to alice, eve's project WRITE covers it (records in it)
    expect(await unlink(eve.id, w.project.id, w.r1.id)).toBe(1);
  });

  it('the project creator and an admin may link; a stranger to the project may not', async () => {
    const own = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.alice.id, title: 'alice2' },
    });
    await link(w.alice.id, p2.id, own.id);
    await link(w.admin.id, p2.id, mine.id);
    await expect(link(w.bob.id, w.project.id, w.r2.id)).rejects.toThrow();
    expect(await unlink(w.bob.id, p2.id, mine.id)).toBe(0);
  });

  it('app: moving a record between projects works for a writer of both; unchanged lists need no project right', async () => {
    const moved = await runAs(w.alice.id, () => updateRecord(w.r1.id, { projectIds: [p2.id] }));
    expect(moved.id).toBe(w.r1.id);
    expect(
      (await prismaOwner.projectRecord.findMany({ where: { recordId: w.r1.id } })).map(
        (l) => l.projectId,
      ),
    ).toEqual([p2.id]);
    // eve writes her record, which sits in P where she has only READ: saving with the same
    // project list must not try to touch the link
    await prismaOwner.projectRecord.create({
      data: { projectId: w.project.id, recordId: mine.id },
    });
    await grant('READ');
    const same = await runAs(eve.id, () =>
      updateRecord(mine.id, { title: 'renamed', projectIds: [w.project.id] }),
    );
    expect(same.title).toBe('renamed');
    // but she cannot add herself to another project she only reads, or leave this one
    await expect(runAs(eve.id, () => updateRecord(mine.id, { projectIds: [] }))).rejects.toThrow();
  });
});
