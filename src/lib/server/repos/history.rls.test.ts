import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, prismaOwner } from '$lib/prisma';
import { runAs } from '$lib/server/db/context';
import { makeWorld, type World } from '$lib/server/db/rls.testutil';

// Record history under row-level security. The only door to lit_history is the function
// lit_record_history(); the app and the gateway cannot touch the table.
//   alice  creates R1 (and is in P with it), owns the hidden Rh
//   bob    sees nothing of R1;  dora  reads R2 with amounts masked;  admin sees everything
let w: World;
beforeEach(async () => {
  w = await makeWorld();
});

type Row = {
  id: bigint;
  tableName: string;
  entityId: string;
  action: string;
  data: Record<string, unknown> | null;
  changed: string[] | null;
  actorId: string | null;
};
/** Everything captured about an entity, oldest first, straight from the table (owner). */
const captured = (entityId: string) =>
  prismaOwner.$queryRaw<Row[]>`SELECT id, "tableName", "entityId", action, data, changed, "actorId"
    FROM lit_history WHERE "entityId" = ${entityId} ORDER BY id`;
const totalRows = async () => Number((await prismaOwner.history.count()) as number);

describe('lit_history table', () => {
  it('has the D5 shape: new data only, changed names, no old/new pair', async () => {
    const cols = await prismaOwner.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lit_history' ORDER BY column_name`;
    expect(Object.fromEntries(cols.map((c) => [c.column_name, c.data_type]))).toEqual({
      id: 'bigint',
      createdAt: 'timestamp with time zone',
      tableName: 'text',
      entityId: 'text',
      action: 'USER-DEFINED',
      data: 'jsonb',
      changed: 'ARRAY',
      actorId: 'text',
    });
    const actions = await prismaOwner.$queryRaw<{ e: string }[]>`
      SELECT unnest(enum_range(NULL::"HistoryAction"))::text AS e`;
    expect(actions.map((a) => a.e)).toEqual(['INSERT', 'UPDATE', 'DELETE', 'REDACT']);
  });

  it('is closed to the app and gateway roles: RLS on, no policy, no privilege on table or sequence', async () => {
    const [t] = await prismaOwner.$queryRaw<{ rls: boolean; policies: bigint }[]>`
      SELECT c.relrowsecurity AS rls,
             (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
      FROM pg_class c WHERE c.oid = 'public.lit_history'::regclass`;
    expect(t.rls).toBe(true);
    expect(Number(t.policies)).toBe(0);
    for (const role of ['lit_app', 'lit_gateway', 'public']) {
      const [p] = await prismaOwner.$queryRawUnsafe<{ ok: boolean }[]>(
        `SELECT (has_table_privilege('${role}', 'lit_history', 'SELECT')
              OR has_table_privilege('${role}', 'lit_history', 'INSERT')
              OR has_table_privilege('${role}', 'lit_history', 'UPDATE')
              OR has_table_privilege('${role}', 'lit_history', 'DELETE')
              OR has_sequence_privilege('${role}', 'lit_history_id_seq', 'USAGE')
              OR has_sequence_privilege('${role}', 'lit_history_id_seq', 'SELECT')) AS ok`,
      );
      expect({ role, ok: p.ok }).toEqual({ role, ok: false });
    }
    await expect(
      runAs(w.admin.id, () => prisma.$queryRaw`SELECT * FROM lit_history`),
    ).rejects.toThrow();
  });

  it('keeps the actor foreign key ON DELETE SET NULL and none on entityId', async () => {
    const fks = await prismaOwner.$queryRaw<{ col: string; del: string }[]>`
      SELECT a.attname AS col, c.confdeltype::text AS del FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.lit_history'::regclass AND c.contype = 'f'`;
    expect(fks).toEqual([{ col: 'actorId', del: 'n' }]);
  });
});

describe('capture', () => {
  it('writes nothing when there is no acting user: owner writes, scripts, seeds (D2)', async () => {
    // makeWorld created users, records and links through the owner connection
    expect(await totalRows()).toBe(0);
    await prismaOwner.record.update({ where: { id: w.r1.id }, data: { title: 'owner edit' } });
    await prismaOwner.record.delete({ where: { id: w.rh.id } });
    expect(await totalRows()).toBe(0);
  });

  it('writes nothing for an unknown or inactive user id', async () => {
    for (const uid of ['u_ghost', w.gone.id]) {
      await prismaOwner.$transaction([
        prismaOwner.$executeRaw`SELECT set_config('app.user_id', ${uid}, true)`,
        prismaOwner.record.update({ where: { id: w.r1.id }, data: { title: `by ${uid}` } }),
      ]);
    }
    expect(await totalRows()).toBe(0);
  });

  it('records an insert by the actor with the whole new row and no changed list', async () => {
    const made = await runAs(w.alice.id, () =>
      prisma.record.create({ data: { typeId: w.type.id, creatorId: w.alice.id, title: 'fresh' } }),
    );
    const rows = await captured(made.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tableName: 'lit_record',
      action: 'INSERT',
      actorId: w.alice.id,
      changed: null,
    });
    expect(rows[0].data).toMatchObject({ id: made.id, title: 'fresh', typeId: w.type.id });
  });

  it('records an update with the new row and the sorted names of the changed columns', async () => {
    await runAs(w.alice.id, () =>
      prisma.record.update({ where: { id: w.r1.id }, data: { title: 'second', note: 'n' } }),
    );
    const [row] = await captured(w.r1.id);
    expect(row).toMatchObject({
      action: 'UPDATE',
      actorId: w.alice.id,
      changed: ['note', 'title'],
    });
    expect(row.data).toMatchObject({ title: 'second', note: 'n', sum: 100 });
  });

  it('does not record a save that changes nothing but updatedAt', async () => {
    await runAs(
      w.alice.id,
      () => prisma.record.update({ where: { id: w.r1.id }, data: { title: 'R1' } }), // same value
    );
    expect(await totalRows()).toBe(0);
  });

  it('keeps the last state of a deleted record, and records its cascaded link', async () => {
    await runAs(w.alice.id, () => prisma.record.delete({ where: { id: w.r1.id } }));
    const rows = await captured(w.r1.id);
    expect(rows.map((r) => `${r.tableName} ${r.action}`)).toEqual(
      expect.arrayContaining(['lit_record DELETE', 'lit_project_record DELETE']),
    );
    const del = rows.find((r) => r.tableName === 'lit_record')!;
    expect(del).toMatchObject({ actorId: w.alice.id, changed: null });
    expect(del.data).toMatchObject({ id: w.r1.id, title: 'R1', sum: 100 });
    const link = rows.find((r) => r.tableName === 'lit_project_record')!;
    expect(link.data).toEqual({ projectId: w.project.id, recordId: w.r1.id });
  });

  it('records a project link under the record id, on add and on remove', async () => {
    const r = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.alice.id, title: 'linked' },
    });
    const key = { projectId_recordId: { projectId: w.project.id, recordId: r.id } };
    await runAs(w.alice.id, () =>
      prisma.projectRecord.create({ data: { projectId: w.project.id, recordId: r.id } }),
    );
    await runAs(w.alice.id, () => prisma.projectRecord.delete({ where: key }));
    const rows = await captured(r.id);
    expect(rows.map((x) => `${x.tableName} ${x.action} ${x.actorId}`)).toEqual([
      `lit_project_record INSERT ${w.alice.id}`,
      `lit_project_record DELETE ${w.alice.id}`,
    ]);
  });

  it('is a definer trigger function the app and gateway cannot call, with a pinned search_path', async () => {
    const [f] = await prismaOwner.$queryRaw<
      { secdef: boolean; cfg: string[]; app: boolean; gw: boolean; pub: boolean }[]
    >`SELECT p.prosecdef AS secdef, p.proconfig AS cfg,
             has_function_privilege('lit_app', p.oid, 'EXECUTE') AS app,
             has_function_privilege('lit_gateway', p.oid, 'EXECUTE') AS gw,
             has_function_privilege('public', p.oid, 'EXECUTE') AS pub
      FROM pg_proc p WHERE p.oid = 'public.lit_capture_history()'::regprocedure`;
    expect(f).toEqual({
      secdef: true,
      cfg: ['search_path=pg_catalog, public, pg_temp'],
      app: false,
      gw: false,
      pub: false,
    });
  });
});

type Seen = {
  id: number;
  createdAt: Date;
  tableName: string;
  action: string;
  data: Record<string, unknown> | null;
  changed: string[] | null;
  actorId: string | null;
};
/** The history door as the app calls it: scoped to `userId`, row-level security deciding. */
const door = async (userId: string | null, recordId: string, before?: number, max?: number) =>
  (
    await runAs(
      userId,
      () =>
        prisma.$queryRaw<Seen[]>`SELECT * FROM lit_record_history(${recordId},
        ${before ?? null}::bigint, ${max ?? 50}::int)`,
    )
  ).map((r) => ({ ...r, id: Number(r.id) }));
const edit = (userId: string, id: string, data: Record<string, unknown>) =>
  runAs(userId, () => prisma.record.update({ where: { id }, data }));
const summary = (rows: Seen[]) =>
  rows.map((r) => `${r.tableName} ${r.action} ${(r.changed ?? []).join(',')}`);

describe('read door', () => {
  let p2: { id: string };
  beforeEach(async () => {
    p2 = await prismaOwner.project.create({ data: { code: 'P2', creatorId: w.admin.id } });
    // R1: alice edits the title, the admin changes the sum and links R1 to P2 (alice cannot see P2)
    await edit(w.alice.id, w.r1.id, { title: 'second' });
    await edit(w.admin.id, w.r1.id, { sum: 999 });
    await runAs(w.admin.id, () =>
      prisma.projectRecord.create({ data: { projectId: p2.id, recordId: w.r1.id } }),
    );
    // R2: bob edits the title, then the sum, then both. Dora reads R2 with amounts masked
    await edit(w.bob.id, w.r2.id, { title: 'two' });
    await edit(w.bob.id, w.r2.id, { sum: 77 });
    await edit(w.bob.id, w.r2.id, { title: 'twice', sum: 78 });
  });

  it('shows a reader the record history newest first, with the amounts they may see', async () => {
    const rows = await door(w.alice.id, w.r1.id);
    expect(summary(rows)).toEqual(['lit_record UPDATE sum', 'lit_record UPDATE title']);
    expect(rows.map((r) => r.actorId)).toEqual([w.admin.id, w.alice.id]);
    expect(rows[0].data).toMatchObject({ id: w.r1.id, title: 'second', sum: 999 });
    expect(rows[1].changed).toEqual(['title']);
    expect(rows[0].id).toBeGreaterThan(rows[1].id);
  });

  it('shows nothing to someone who cannot read the record, to nobody, to an inactive user, or for an unknown id', async () => {
    expect(await door(w.bob.id, w.r1.id)).toEqual([]);
    expect(await door(null, w.r1.id)).toEqual([]);
    expect(await door(w.gone.id, w.r1.id)).toEqual([]);
    expect(await door(w.alice.id, 'no-such-record')).toEqual([]);
    expect(await door(w.dora.id, w.r1.id)).toEqual([]);
  });

  it('is not callable by the gateway or the public', async () => {
    const [f] = await prismaOwner.$queryRaw<{ gw: boolean; pub: boolean; app: boolean }[]>`
      SELECT has_function_privilege('lit_gateway', 'lit_record_history(text,bigint,int)', 'EXECUTE') AS gw,
             has_function_privilege('public', 'lit_record_history(text,bigint,int)', 'EXECUTE') AS pub,
             has_function_privilege('lit_app', 'lit_record_history(text,bigint,int)', 'EXECUTE') AS app`;
    expect(f).toEqual({ gw: false, pub: false, app: true });
    await expect(
      prismaOwner.$transaction([
        prismaOwner.$executeRaw`SELECT set_config('role', 'lit_gateway', true), set_config('app.user_id', ${w.alice.id}, true)`,
        prismaOwner.$queryRaw`SELECT * FROM lit_record_history(${w.r1.id})`,
      ]),
    ).rejects.toThrow(/permission denied/);
  });

  it('keeps the helper functions out of reach of the app and the gateway', async () => {
    const fns = await prismaOwner.$queryRaw<{ name: string; app: boolean; gw: boolean }[]>`
      SELECT p.proname AS name, has_function_privilege('lit_app', p.oid, 'EXECUTE') AS app,
             has_function_privilege('lit_gateway', p.oid, 'EXECUTE') AS gw
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
        AND p.proname IN ('lit_capture_history', 'lit_history_columns',
          'lit_history_hidden_at', 'lit_guard_record_insert')`;
    expect(fns.map((f) => f.name).sort()).toEqual([
      'lit_capture_history',
      'lit_guard_record_insert',
      'lit_history_columns',
      'lit_history_hidden_at',
    ]);
    expect(fns.every((f) => !f.app && !f.gw)).toBe(true);
  });

  it('shows project links only to those who can read the project', async () => {
    // the link to P2 is the admin's alone; alice sees R1 but not P2
    expect(
      summary(await door(w.alice.id, w.r1.id)).some((s) => s.startsWith('lit_project_record')),
    ).toBe(false);
    const admin = await door(w.admin.id, w.r1.id);
    expect(summary(admin)[0]).toBe('lit_project_record INSERT ');
    expect(admin[0].data).toEqual({ projectId: p2.id, recordId: w.r1.id });
    // once alice may read P2 (here: she creates a link to her own P), she sees that link
    await runAs(w.alice.id, () =>
      prisma.projectRecord.delete({
        where: { projectId_recordId: { projectId: w.project.id, recordId: w.r1.id } },
      }),
    );
    expect(summary(await door(w.alice.id, w.r1.id))[0]).toBe('lit_project_record DELETE ');
  });

  it('limits keys and changed names to the app column grants and hides masked amounts', async () => {
    const rows = await door(w.dora.id, w.r2.id);
    for (const r of rows) {
      for (const k of ['sum', 'hours', 'total']) expect(r.data).not.toHaveProperty(k);
      expect(r.changed ?? []).not.toContain('sum');
    }
    const asBob = await door(w.bob.id, w.r2.id); // creator: sees amounts
    expect(asBob[0].data).toMatchObject({ sum: 78 });
    expect(asBob[0].changed).toEqual(['sum', 'title']);
  });

  it('hides an update whose only change is a masked amount; the admin and the amount reader see it', async () => {
    expect(summary(await door(w.dora.id, w.r2.id))).toEqual([
      'lit_record UPDATE title',
      'lit_record UPDATE title',
    ]);
    expect(summary(await door(w.bob.id, w.r2.id))).toEqual([
      'lit_record UPDATE sum,title',
      'lit_record UPDATE sum',
      'lit_record UPDATE title',
    ]);
    expect(summary(await door(w.admin.id, w.r2.id))).toHaveLength(3);
  });

  it('pages newest first with a cursor, default 50, at most 200', async () => {
    const all = await door(w.admin.id, w.r2.id);
    expect(all).toHaveLength(3);
    const first = await door(w.admin.id, w.r2.id, undefined, 2);
    expect(first.map((r) => r.id)).toEqual(all.slice(0, 2).map((r) => r.id));
    const rest = await door(w.admin.id, w.r2.id, first[1].id, 2);
    expect(rest.map((r) => r.id)).toEqual([all[2].id]);
    expect(await door(w.admin.id, w.r2.id, all[2].id)).toEqual([]);
    // 205 history rows for one record: the default page is 50, a larger request is capped at 200
    for (let i = 0; i < 205; i++) await edit(w.admin.id, w.r2.id, { note: `n${i}` });
    expect(await door(w.admin.id, w.r2.id)).toHaveLength(50);
    expect(await door(w.admin.id, w.r2.id, undefined, 1000)).toHaveLength(200);
    expect(await door(w.admin.id, w.r2.id, undefined, 0)).toHaveLength(1);
  });
});

describe('hidden period', () => {
  it('never shows non-admins what happened while the record was hidden, un-hide included', async () => {
    const r = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.alice.id, title: 'v1' },
    });
    await edit(w.alice.id, r.id, { note: 'visible edit' });
    await edit(w.admin.id, r.id, { hidden: true });
    await edit(w.admin.id, r.id, { title: 'secret' });
    await edit(w.admin.id, r.id, { hidden: false, title: 'public again' });
    await edit(w.alice.id, r.id, { note: 'after' });
    const asAlice = await door(w.alice.id, r.id);
    expect(summary(asAlice)).toEqual(['lit_record UPDATE note', 'lit_record UPDATE note']);
    expect(JSON.stringify(asAlice)).not.toContain('secret');
    const asAdmin = await door(w.admin.id, r.id);
    expect(summary(asAdmin)).toEqual([
      'lit_record UPDATE note',
      'lit_record UPDATE hidden,title',
      'lit_record UPDATE title',
      'lit_record UPDATE hidden',
      'lit_record UPDATE note',
    ]);
  });

  it('hides the insert of a record created hidden, and the delete of one deleted while hidden', async () => {
    const made = await runAs(w.admin.id, () =>
      prisma.record.create({
        data: { typeId: w.type.id, creatorId: w.alice.id, title: 'born hidden', hidden: true },
      }),
    );
    await edit(w.admin.id, made.id, { hidden: false });
    await edit(w.alice.id, made.id, { note: 'n' });
    expect(summary(await door(w.alice.id, made.id))).toEqual(['lit_record UPDATE note']);
    expect(summary(await door(w.admin.id, made.id))).toHaveLength(3);
    // a hidden record that is deleted: nobody but the admin ever sees any of it
    await edit(w.admin.id, made.id, { hidden: true });
    await runAs(w.admin.id, () => prisma.record.delete({ where: { id: made.id } }));
    expect(await door(w.alice.id, made.id)).toEqual([]);
    expect(summary(await door(w.admin.id, made.id))).toHaveLength(5);
  });
});

describe('project links in the hidden period', () => {
  const proj = (code: string) =>
    prismaOwner.project.create({ data: { code, creatorId: w.alice.id } });
  const link = (projectId: string, recordId: string) =>
    runAs(w.admin.id, () => prisma.projectRecord.create({ data: { projectId, recordId } }));
  const unlink = (projectId: string, recordId: string) =>
    runAs(w.admin.id, () =>
      prisma.projectRecord.delete({ where: { projectId_recordId: { projectId, recordId } } }),
    );

  it('hides links added and removed while the record was hidden, once it is visible again', async () => {
    const [a, b, c] = [await proj('LA'), await proj('LB'), await proj('LC')];
    const r = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.alice.id, title: 'v1' },
    });
    await edit(w.alice.id, r.id, { note: 'n' });
    await link(a.id, r.id); // visible
    await edit(w.admin.id, r.id, { hidden: true });
    await link(b.id, r.id); // hidden period
    await unlink(b.id, r.id);
    await edit(w.admin.id, r.id, { hidden: false });
    await link(c.id, r.id); // visible
    const asAlice = (await door(w.alice.id, r.id)).filter(
      (x) => x.tableName === 'lit_project_record',
    );
    expect(asAlice.map((x) => [x.action, x.data?.projectId])).toEqual([
      ['INSERT', c.id],
      ['INSERT', a.id],
    ]);
    const asAdmin = (await door(w.admin.id, r.id)).filter(
      (x) => x.tableName === 'lit_project_record',
    );
    expect(asAdmin).toHaveLength(4);
  });

  it('infers the hidden state from the later un-hide when no earlier record row exists', async () => {
    const b = await proj('LB2');
    const r = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.alice.id, title: 'owner made', hidden: true },
    });
    await link(b.id, r.id); // no lit_record row before it: the owner created the record
    await edit(w.admin.id, r.id, { hidden: false });
    const links = (await door(w.alice.id, r.id)).filter(
      (x) => x.tableName === 'lit_project_record',
    );
    expect(links).toEqual([]);
    expect(
      (await door(w.admin.id, r.id)).filter((x) => x.tableName === 'lit_project_record'),
    ).toHaveLength(1);
  });
});

describe('rows without a changed list', () => {
  it('shows the insert and the delete of a visible record to a reader', async () => {
    const made = await runAs(w.alice.id, () =>
      prisma.record.create({ data: { typeId: w.type.id, creatorId: w.alice.id, title: 'plain' } }),
    );
    expect(summary(await door(w.alice.id, made.id))).toEqual(['lit_record INSERT ']);
    expect(summary(await door(w.admin.id, made.id))).toEqual(['lit_record INSERT ']);
    await runAs(w.alice.id, () => prisma.record.delete({ where: { id: made.id } }));
    // the record is gone: only the admin can still read its history
    expect(await door(w.alice.id, made.id)).toEqual([]);
    expect(summary(await door(w.admin.id, made.id))).toEqual([
      'lit_record DELETE ',
      'lit_record INSERT ',
    ]);
  });
});

describe('TEMP-table attack', () => {
  it('a session TEMP table named lit_history neither captures nor forges history', async () => {
    const before = await prismaOwner.history.count();
    const as = (uid: string) => [
      prismaOwner.$executeRaw`SELECT set_config('role', 'lit_app', true), set_config('app.user_id', ${uid}, true)`,
    ];
    const out = await prismaOwner.$transaction([
      ...as(w.alice.id),
      prismaOwner.$executeRawUnsafe(
        `CREATE TEMP TABLE lit_history (id bigserial, "createdAt" timestamptz DEFAULT now(), "tableName" text, "entityId" text, action "HistoryAction", data jsonb, changed text[], "actorId" text) ON COMMIT DROP`,
      ),
      prismaOwner.$executeRawUnsafe(
        `CREATE TEMP TABLE lit_record (id text, title text, hidden boolean) ON COMMIT DROP`,
      ),
      prismaOwner.$executeRawUnsafe(
        `UPDATE public.lit_record SET title = 'evade?' WHERE id = '${w.r1.id}'`,
      ),
      prismaOwner.$executeRawUnsafe(
        `INSERT INTO pg_temp.lit_history ("tableName","entityId",action,data,"actorId")
         VALUES ('lit_record','${w.r1.id}','INSERT','{"title":"forged"}','${w.alice.id}')`,
      ),
      prismaOwner.$queryRawUnsafe<Seen[]>(`SELECT * FROM lit_record_history('${w.r1.id}')`),
      prismaOwner.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM pg_temp.lit_history`),
    ]);
    // (the temp tables die with the transaction: a pooled connection must not keep shadows)
    const seen = out[5] as Seen[];
    expect(seen.map((r) => r.data?.title)).toEqual(['evade?']); // captured for real, nothing forged
    expect(Number((out[6] as { n: bigint }[])[0].n)).toBe(1); // only the forged row, in the temp table
    expect(await prismaOwner.history.count()).toBe(before + 1);
  });
});

describe('reused record ids', () => {
  it('refuses an app insert with the id of a record that has history, and lets the owner re-insert', async () => {
    const made = await runAs(w.alice.id, () =>
      prisma.record.create({ data: { typeId: w.type.id, creatorId: w.alice.id, title: 'mine' } }),
    );
    await edit(w.alice.id, made.id, { title: 'edited secret' });
    await runAs(w.alice.id, () => prisma.record.delete({ where: { id: made.id } }));
    // bob takes the id of the deleted record and would become its creator, so able to read its past
    await expect(
      runAs(w.bob.id, () =>
        prisma.record.create({
          data: { id: made.id, typeId: w.type.id, creatorId: w.bob.id, title: 'squat' },
        }),
      ),
    ).rejects.toThrow(/history/i);
    expect(await prismaOwner.record.count({ where: { id: made.id } })).toBe(0);
    expect(await door(w.bob.id, made.id)).toEqual([]);
    // the owner path (seeds, restores) is not an app write and stays allowed
    await prismaOwner.record.create({
      data: { id: made.id, typeId: w.type.id, creatorId: w.alice.id, title: 'restored' },
    });
    expect(await prismaOwner.record.count({ where: { id: made.id } })).toBe(1);
    // an id with no history is free for the app
    const fresh = await runAs(w.bob.id, () =>
      prisma.record.create({
        data: { id: 'rec_free_id', typeId: w.type.id, creatorId: w.bob.id, title: 'ok' },
      }),
    );
    expect(fresh.id).toBe('rec_free_id');
  });

  it('refuses an app insert with an id whose only history is a project link', async () => {
    // an owner-made record (not captured), linked through the app, then deleted by the owner
    // (not captured): only link rows remain, and they must still block the id
    const r = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.alice.id, title: 'link only' },
    });
    await runAs(w.alice.id, () =>
      prisma.projectRecord.create({ data: { projectId: w.project.id, recordId: r.id } }),
    );
    await prismaOwner.record.delete({ where: { id: r.id } });
    await expect(
      runAs(w.bob.id, () =>
        prisma.record.create({
          data: { id: r.id, typeId: w.type.id, creatorId: w.bob.id, title: 'squat' },
        }),
      ),
    ).rejects.toThrow(/history/i);
  });
});

describe('record id guard', () => {
  it('refuses to change a record id, for the owner and for the admin, and leaves history attached', async () => {
    await expect(
      prismaOwner.$executeRaw`UPDATE lit_record SET id = 'renamed' WHERE id = ${w.r1.id}`,
    ).rejects.toThrow(/id/i);
    await expect(
      prismaOwner.$transaction([
        prismaOwner.$executeRaw`SELECT set_config('role', 'lit_app', true), set_config('app.user_id', ${w.admin.id}, true)`,
        prismaOwner.$executeRaw`UPDATE lit_record SET id = 'renamed' WHERE id = ${w.r1.id}`,
      ]),
    ).rejects.toThrow(/id/i);
    expect(await prismaOwner.record.count({ where: { id: 'renamed' } })).toBe(0);
    // saving the same id (an update that lists it) is not a change
    await prismaOwner.$executeRaw`UPDATE lit_record SET id = id, note = 'ok' WHERE id = ${w.r1.id}`;
    expect((await prismaOwner.record.findUnique({ where: { id: w.r1.id } }))?.note).toBe('ok');
  });
});

describe('redact', () => {
  const redact = (userId: string | null, recordId: string, fields: string[] | null) =>
    runAs(
      userId,
      () => prisma.$executeRaw`SELECT lit_history_redact(${recordId}, ${fields}::text[])`,
    );
  beforeEach(async () => {
    await edit(w.alice.id, w.r1.id, { title: 'secret title', note: 'keep me' });
    await edit(w.alice.id, w.r1.id, { title: 'second secret' });
    await edit(w.bob.id, w.r2.id, { title: 'other record' });
  });

  it('lets only an admin redact: the owner of the record, others, nobody and the inactive are refused', async () => {
    for (const uid of [w.alice.id, w.bob.id, w.dora.id, w.gone.id, null]) {
      await expect(redact(uid, w.r1.id, ['title'])).rejects.toThrow(/admin/i);
    }
    const rows = await captured(w.r1.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.data?.title)).toEqual(['secret title', 'second secret']);
  });

  it('nulls the fields in every snapshot of the record, leaves changed and everything else, and logs a REDACT row', async () => {
    await redact(w.admin.id, w.r1.id, ['note', 'title', 'note']);
    const rows = await captured(w.r1.id);
    expect(rows.map((r) => `${r.action} ${(r.changed ?? []).join(',')}`)).toEqual([
      'UPDATE note,title',
      'UPDATE title',
      'REDACT note,title',
    ]);
    for (const r of rows.slice(0, 2)) {
      expect(r.data).toMatchObject({ title: null, note: null, id: w.r1.id, typeId: w.type.id });
      expect(r.data).toHaveProperty('title', null);
    }
    expect(rows[2]).toMatchObject({
      tableName: 'lit_record',
      entityId: w.r1.id,
      actorId: w.admin.id,
    });
    expect(rows[2].data).toEqual({ fields: ['note', 'title'] }); // sorted, once each
    // another record is untouched
    expect((await captured(w.r2.id))[0].data).toMatchObject({ title: 'other record' });
  });

  it('keeps links, and redacts a deleted record too', async () => {
    await runAs(w.alice.id, () => prisma.record.delete({ where: { id: w.r1.id } }));
    await redact(w.admin.id, w.r1.id, ['title']);
    const rows = await captured(w.r1.id);
    const del = rows.find((r) => r.action === 'DELETE' && r.tableName === 'lit_record')!;
    expect(del.data).toMatchObject({ title: null, id: w.r1.id });
    const link = rows.find((r) => r.tableName === 'lit_project_record')!;
    expect(link.data).toEqual({ projectId: w.project.id, recordId: w.r1.id });
    expect(rows.filter((r) => r.action === 'REDACT')).toHaveLength(1);
  });

  it('shows redacted values as null to the admin, and the REDACT row only to the admin', async () => {
    await redact(w.admin.id, w.r1.id, ['title']);
    const asAdmin = await door(w.admin.id, w.r1.id);
    expect(asAdmin[0]).toMatchObject({ action: 'REDACT', changed: ['title'], actorId: w.admin.id });
    expect(asAdmin.filter((r) => r.action === 'UPDATE').map((r) => r.data?.title)).toEqual([
      null,
      null,
    ]);
    const asAlice = await door(w.alice.id, w.r1.id);
    expect(asAlice.map((r) => r.action)).toEqual(['UPDATE', 'UPDATE']);
    expect(asAlice.map((r) => r.data?.title)).toEqual([null, null]);
  });

  it('a second redaction does not write the field into the REDACT rows', async () => {
    await redact(w.admin.id, w.r1.id, ['title']);
    await redact(w.admin.id, w.r1.id, ['note']);
    const redacts = (await captured(w.r1.id)).filter((r) => r.action === 'REDACT');
    expect(redacts.map((r) => r.data)).toEqual([{ fields: ['title'] }, { fields: ['note'] }]);
  });

  it('refuses an empty or null list, id, hidden, and names that are not record columns', async () => {
    const bad: (string[] | null)[] = [
      [],
      null,
      ['id'],
      ['hidden'],
      ['title', 'hidden'],
      ['nope'],
      ['title', 'lit_user'],
      ['"title"'],
    ];
    for (const fields of bad) {
      await expect(redact(w.admin.id, w.r1.id, fields)).rejects.toThrow();
    }
    await expect(
      runAs(
        w.admin.id,
        () =>
          prisma.$executeRaw`SELECT lit_history_redact(${w.r1.id}, ARRAY['title', NULL]::text[])`,
      ),
    ).rejects.toThrow();
    const rows = await captured(w.r1.id);
    expect(rows).toHaveLength(2); // nothing was redacted, nothing logged
    expect(rows[0].data?.title).toBe('secret title');
  });

  it('refuses a record that has no record history, and writes no orphan REDACT row', async () => {
    const before = await totalRows();
    await expect(redact(w.admin.id, 'rec_never_existed', ['title'])).rejects.toThrow(/no history/i);
    // the owner made this record, so nothing was captured for it
    const silent = await prismaOwner.record.create({
      data: { typeId: w.type.id, creatorId: w.alice.id, title: 'silent' },
    });
    await expect(redact(w.admin.id, silent.id, ['title'])).rejects.toThrow(/no history/i);
    expect(await totalRows()).toBe(before);
  });

  it('is executable by the app only: not by the gateway or the public', async () => {
    const [f] = await prismaOwner.$queryRaw<{ app: boolean; gw: boolean; pub: boolean }[]>`
      SELECT has_function_privilege('lit_app', 'lit_history_redact(text,text[])', 'EXECUTE') AS app,
             has_function_privilege('lit_gateway', 'lit_history_redact(text,text[])', 'EXECUTE') AS gw,
             has_function_privilege('public', 'lit_history_redact(text,text[])', 'EXECUTE') AS pub`;
    expect(f).toEqual({ app: true, gw: false, pub: false });
  });
});
