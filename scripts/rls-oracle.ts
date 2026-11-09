/**
 * Exact oracle test for the grants-as-data row-level security (see README, "Permissions").
 *
 *   bun scripts/rls-oracle.ts                       # throwaway Docker Postgres, generated data + Franklin seeds
 *   bun scripts/rls-oracle.ts --data generated --seeds 40
 *   bun scripts/rls-oracle.ts --db postgresql://postgres:pw@127.0.0.1:5491/lit_rls_admin   # an existing THROWAWAY server
 *
 * For every random overlay seed it migrates once, loads data, applies a seeded overlay of
 * groups, memberships, grants, hidden records, inactive users, amounts ... (inside a transaction that is
 * rolled back), and then for EVERY user (and the anonymous and unknown user) compares what
 * Postgres lets the role lit_app and the role lit_gateway see, update, delete and insert
 * with an independent oracle written here in TS. The oracle does not call any policy or
 * helper function. Exit code 1 on any mismatch. Safety: only loopback, never port 5433,
 * database names start with lit_rls_, never the DATABASE_URL / DIRECT_URL / TEST_DATABASE_URL
 * of the environment.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- args ----------
const args = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const SEEDS = Number(arg('seeds', '25'));
const FRANKLIN_SEEDS = Number(arg('franklin-seeds', '3'));
const seedsDir = resolve(root, arg('seeds-dir', '../lit-crm-seeds')!);
const dataMode = arg('data', existsSync(seedsDir) ? 'both' : 'generated')!;
const FROM = Number(arg('from', '1'));
const keep = args.includes('--keep');

// ---------- safety ----------
function assertThrowaway(url: string) {
  const u = new URL(url);
  const forbidden = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.TEST_DATABASE_URL,
  ].filter(Boolean);
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(u.hostname))
    throw new Error(`refusing non-loopback host ${u.hostname}`);
  if (u.port === '5433') throw new Error('refusing port 5433');
  if (/neon/i.test(url)) throw new Error('refusing a neon url');
  if (!/^lit_rls_/.test(u.pathname.slice(1)))
    throw new Error('database name must start with lit_rls_');
  if (forbidden.some((f) => f && new URL(f).host === u.host && new URL(f).pathname === u.pathname))
    throw new Error('refusing a database named in the environment');
}
const withDb = (url: string, db: string) => {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
};

// ---------- tiny helpers ----------
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const pick = <T>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const sample = <T>(r: Rng, xs: T[], n: number): T[] => {
  const c = xs.slice();
  const out: T[] = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(r() * c.length), 1)[0]);
  return out;
};

let failures = 0;
let comparisons = 0;
let elementsCompared = 0;
const mismatchLog: string[] = [];
function compare(label: string, got: Iterable<string>, want: Iterable<string>) {
  const g = new Set(got);
  const w = new Set(want);
  comparisons++;
  elementsCompared += Math.max(g.size, w.size);
  const extra = [...g].filter((x) => !w.has(x));
  const missing = [...w].filter((x) => !g.has(x));
  if (extra.length || missing.length) {
    failures++;
    if (mismatchLog.length < 60)
      mismatchLog.push(
        `MISMATCH ${label}: db-only ${extra.length} [${extra.slice(0, 3)}], oracle-only ${missing.length} [${missing.slice(0, 3)}]`,
      );
  }
}
function expect(label: string, ok: boolean, detail = '') {
  comparisons++;
  elementsCompared++;
  if (!ok) {
    failures++;
    mismatchLog.push(`FAIL ${label} ${detail}`);
  }
}

// ---------- the data model the oracle works on ----------
type U = { id: string; status: string; isAdmin: boolean };
type R = {
  id: string;
  status: string;
  hidden: boolean;
  typeId: string;
  creatorId: string | null;
  assigneeId: string | null;
  sum: string | null;
  hours: string | null;
  total: string | null;
};
type P = { id: string; status: string; creatorId: string | null; assigneeId: string | null };
type G = {
  id: string;
  userId: string | null;
  groupId: string | null;
  personId: string | null;
  projectId: string | null;
  typeId: string | null;
  recordId: string | null;
  level: string;
  hideAmounts: boolean;
};
type World = {
  users: U[];
  typeIds: string[];
  groupIds: string[];
  members: { groupId: string; userId: string }[];
  grants: G[];
  projects: P[];
  records: R[];
  links: { projectId: string; recordId: string }[];
  mentions: { id: string; sourceId: string; entityId: string }[];
};

async function loadWorld(c: pg.Client): Promise<World> {
  const q = async <T>(sql: string) => (await c.query(sql)).rows as T[];
  return {
    users: await q<U>(`select id, status::text, "isAdmin" from lit_user`),
    typeIds: (await q<{ id: string }>(`select id from lit_type`)).map((x) => x.id),
    groupIds: (await q<{ id: string }>(`select id from lit_group`)).map((x) => x.id),
    members: await q(`select "groupId","userId" from lit_group_member`),
    grants: await q<G>(
      `select id,"userId","groupId","personId","projectId","typeId","recordId",level::text,"hideAmounts" from lit_grant`,
    ),
    projects: await q<P>(`select id, status::text, "creatorId","assigneeId" from lit_project`),
    records: await q<R>(
      `select id, status::text, hidden, "typeId","creatorId","assigneeId", sum::text, hours::text, total::text from lit_record`,
    ),
    links: await q(`select "projectId","recordId" from lit_project_record`),
    mentions: await q(`select id, "sourceId", "entityId" from lit_record_mention`),
  };
}

// ---------- the oracle ----------
type Scope = { type: Set<string>; person: Set<string>; record: Set<string>; project: Set<string> };
type Expected = {
  userId: string;
  active: boolean;
  admin: boolean;
  recVisible: Set<string>;
  recWritable: Set<string>;
  recMasked: Set<string>; // visible but amounts hidden
  projVisible: Set<string>;
  projWritable: Set<string>;
  linkVisible: Set<string>; // "projectId|recordId"
  linkWritable: Set<string>;
  mentionVisible: Set<string>; // mention ids: both records visible
  mentionWritable: Set<string>; // write on the source, read on the entity
  linkable: (projectId: string) => boolean;
  groupsVisible: Set<string>;
  membersVisible: Set<string>;
  grantsVisible: Set<string>;
  usersVisible: Set<string>;
  usersWritable: Set<string>;
  typesVisible: Set<string>;
  adminAll: boolean;
};

function buildOracle(w: World) {
  const projById = new Map(w.projects.map((p) => [p.id, p]));
  const projsOfRecord = new Map<string, string[]>();
  for (const l of w.links)
    (projsOfRecord.get(l.recordId) ?? projsOfRecord.set(l.recordId, []).get(l.recordId)!).push(
      l.projectId,
    );
  const groupsOfUser = new Map<string, Set<string>>();
  for (const m of w.members)
    (groupsOfUser.get(m.userId) ?? groupsOfUser.set(m.userId, new Set()).get(m.userId)!).add(
      m.groupId,
    );

  const scope = (): Scope => ({
    type: new Set(),
    person: new Set(),
    record: new Set(),
    project: new Set(),
  });
  const add = (s: Scope, g: G) => {
    if (g.typeId) s.type.add(g.typeId);
    if (g.personId) s.person.add(g.personId);
    if (g.recordId) s.record.add(g.recordId);
    if (g.projectId) s.project.add(g.projectId);
  };

  return (userId: string): Expected => {
    const user = w.users.find((u) => u.id === userId);
    const active = !!user && user.status === 'ACTIVE';
    const admin = active && user!.isAdmin;
    const myGroups = groupsOfUser.get(userId) ?? new Set<string>();
    const mine = active
      ? w.grants.filter(
          (g) => g.userId === userId || (g.groupId !== null && myGroups.has(g.groupId)),
        )
      : [];
    const rd = scope();
    const wr = scope();
    const am = scope();
    for (const g of mine) {
      add(rd, g);
      if (g.level === 'WRITE') add(wr, g);
      if (!g.hideAmounts) add(am, g);
    }
    const matches = (s: Scope, r: R) => {
      if (s.type.has(r.typeId) || s.record.has(r.id)) return true;
      if (r.creatorId && s.person.has(r.creatorId)) return true;
      if (r.assigneeId && s.person.has(r.assigneeId)) return true;
      return (projsOfRecord.get(r.id) ?? []).some((p) => s.project.has(p));
    };
    const implicit = (r: R) =>
      r.creatorId === userId ||
      r.assigneeId === userId ||
      (projsOfRecord.get(r.id) ?? []).some((pid) => {
        const p = projById.get(pid)!;
        return p.creatorId === userId || p.assigneeId === userId;
      });

    const e: Expected = {
      userId,
      active,
      admin,
      recVisible: new Set(),
      recWritable: new Set(),
      recMasked: new Set(),
      projVisible: new Set(),
      projWritable: new Set(),
      linkVisible: new Set(),
      linkWritable: new Set(),
      mentionVisible: new Set(),
      mentionWritable: new Set(),
      linkable: () => false,
      groupsVisible: new Set(),
      membersVisible: new Set(),
      grantsVisible: new Set(),
      usersVisible: new Set(),
      usersWritable: new Set(),
      typesVisible: new Set(),
      adminAll: admin,
    };
    if (!active) return e;

    for (const r of w.records) {
      const imp = implicit(r);
      const vis = admin || (!r.hidden && (imp || matches(rd, r)));
      if (!vis) continue;
      e.recVisible.add(r.id);
      if (admin || imp || matches(wr, r)) e.recWritable.add(r.id);
      if (!(admin || imp || matches(am, r))) e.recMasked.add(r.id);
    }
    for (const p of w.projects) {
      const own = p.creatorId === userId || p.assigneeId === userId;
      if (admin || own || rd.project.has(p.id)) e.projVisible.add(p.id);
      if (admin || own) e.projWritable.add(p.id);
    }
    // projects a user may put records into / take records out of: admin, creator, assignee,
    // or a WRITE grant on the project (a READ grant is not enough)
    const linkable = (pid: string) => {
      const p = projById.get(pid);
      return (
        !!p && (admin || p.creatorId === userId || p.assigneeId === userId || wr.project.has(pid))
      );
    };
    e.linkable = linkable;
    for (const l of w.links) {
      const k = `${l.projectId}|${l.recordId}`;
      if (e.recVisible.has(l.recordId) && e.projVisible.has(l.projectId)) e.linkVisible.add(k);
      if (e.recWritable.has(l.recordId) && linkable(l.projectId)) e.linkWritable.add(k);
    }
    // a mention is visible when BOTH records it joins are visible; it is written (inserted,
    // deleted) with WRITE on its source and READ on its entity (planting a mention of a
    // record you cannot see is refused)
    for (const m of w.mentions) {
      if (e.recVisible.has(m.sourceId) && e.recVisible.has(m.entityId)) e.mentionVisible.add(m.id);
      if (e.recWritable.has(m.sourceId) && e.recVisible.has(m.entityId))
        e.mentionWritable.add(m.id);
    }
    for (const g of w.groupIds) if (admin || myGroups.has(g)) e.groupsVisible.add(g);
    for (const m of w.members)
      if (admin || m.userId === userId) e.membersVisible.add(`${m.groupId}|${m.userId}`);
    for (const g of w.grants)
      if (admin || g.userId === userId || (g.groupId !== null && myGroups.has(g.groupId)))
        e.grantsVisible.add(g.id);
    for (const u of w.users) e.usersVisible.add(u.id);
    for (const u of w.users) if (admin || u.id === userId) e.usersWritable.add(u.id);
    for (const t of w.typeIds) e.typesVisible.add(t);
    return e;
  };
}

// ---------- overlay ----------
async function applyOverlay(c: pg.Client, w: World, seed: number) {
  const r = mulberry32(seed * 7919 + 13);
  const users = w.users.map((u) => u.id);
  // users: admins and inactive
  await c.query(`update lit_user set "isAdmin" = false`);
  const admins = sample(r, users, int(r, 1, 3));
  await c.query(`update lit_user set "isAdmin" = true where id = any($1)`, [admins]);
  await c.query(`update lit_user set status = 'ACTIVE'`);
  const inactive = sample(r, users, int(r, 0, 3));
  await c.query(`update lit_user set status = 'INACTIVE' where id = any($1)`, [inactive]);
  // records: hidden 3%, inactive 5%, reassign 5%, null creator/assignee 8%, amounts 40%
  const ids = w.records.map((x) => x.id);
  const n = ids.length;
  const hidden = ids.filter(() => r() < 0.03);
  const inact = ids.filter(() => r() < 0.05);
  await c.query(`update lit_record set hidden = false, status = 'ACTIVE'`);
  if (hidden.length)
    await c.query(`update lit_record set hidden = true where id = any($1)`, [hidden]);
  if (inact.length)
    await c.query(`update lit_record set status = 'INACTIVE' where id = any($1)`, [inact]);
  const cre = ids
    .map((id) => (r() < 0.05 ? [id, r() < 0.3 ? null : pick(r, users)] : null))
    .filter(Boolean) as [string, string | null][];
  if (cre.length)
    await c.query(
      `update lit_record x set "creatorId" = v.u from unnest($1::text[], $2::text[]) as v(id, u) where x.id = v.id`,
      [cre.map((v) => v[0]), cre.map((v) => v[1])],
    );
  const ass = ids
    .map((id) => (r() < 0.05 ? [id, r() < 0.3 ? null : pick(r, users)] : null))
    .filter(Boolean) as [string, string | null][];
  if (ass.length)
    await c.query(
      `update lit_record x set "assigneeId" = v.u from unnest($1::text[], $2::text[]) as v(id, u) where x.id = v.id`,
      [ass.map((v) => v[0]), ass.map((v) => v[1])],
    );
  const amt = ids.filter(() => r() < 0.4);
  await c.query(`update lit_record set sum = null, hours = null, total = null`);
  if (amt.length)
    await c.query(
      `update lit_record x set sum = v.s, hours = v.h, total = v.t
       from unnest($1::text[], $2::numeric[], $3::float8[], $4::numeric[]) as v(id, s, h, t) where x.id = v.id`,
      [
        amt,
        amt.map(() => (r() < 0.1 ? 0 : int(r, 1, 9999) + 0.5)),
        amt.map(() => (r() < 0.1 ? 0 : int(r, 0, 80) / 2)),
        amt.map(() => int(r, 0, 99999)),
      ],
    );
  // projects: inactive 10%, assignee set for some
  await c.query(`update lit_project set status = 'ACTIVE'`);
  const pids = w.projects.map((p) => p.id);
  await c.query(`update lit_project set status = 'INACTIVE' where id = any($1)`, [
    pids.filter(() => r() < 0.1),
  ]);
  const pa = pids.filter(() => r() < 0.3);
  if (pa.length)
    await c.query(
      `update lit_project x set "assigneeId" = v.u from unnest($1::text[], $2::text[]) as v(id, u) where x.id = v.id`,
      [pa, pa.map(() => (r() < 0.2 ? null : pick(r, users)))],
    );
  // mentions: the data's own plus a random set (any two records, visible or not)
  for (let i = 0; i < Math.min(400, n) && n; i++)
    await c.query(
      `insert into lit_record_mention (id,"sourceId","entityId","start","end") values ($1,$2,$3,0,1)`,
      [`mn${seed}_${i}`, pick(r, ids), pick(r, ids)],
    );
  // extra links
  const extra = Math.min(300, Math.floor(n / 2));
  for (let i = 0; i < extra && pids.length; i++)
    await c.query(
      `insert into lit_project_record ("projectId","recordId") values ($1,$2) on conflict do nothing`,
      [pick(r, pids), pick(r, ids)],
    );
  // groups, memberships, grants
  await c.query(`delete from lit_grant`);
  await c.query(`delete from lit_group_member`);
  await c.query(`delete from lit_group`);
  const gcount = int(r, 0, 6);
  const gids: string[] = [];
  for (let i = 0; i < gcount; i++) {
    const id = `grp${seed}_${i}`;
    gids.push(id);
    await c.query(`insert into lit_group (id, name, "updatedAt") values ($1,$2,now())`, [
      id,
      `group ${seed}-${i}`,
    ]);
  }
  for (const u of users)
    for (const g of sample(r, gids, int(r, 0, 3)))
      await c.query(`insert into lit_group_member ("groupId","userId") values ($1,$2)`, [g, u]);
  const gn = int(r, 20, 80);
  for (let i = 0; i < gn; i++) {
    const toGroup = gids.length > 0 && r() < 0.4;
    const target = toGroup ? [null, pick(r, gids)] : [pick(r, users), null];
    const kind = int(r, 0, 3);
    const sc: (string | null)[] = [null, null, null, null]; // person, project, type, record
    sc[kind] =
      kind === 0
        ? pick(r, users)
        : kind === 1
          ? pick(r, pids)
          : kind === 2
            ? pick(r, w.typeIds)
            : pick(r, ids);
    if (kind === 0 && !toGroup && r() < 0.2) sc[0] = target[0]; // self "person" grant
    if (kind === 1 && !pids.length) continue;
    await c.query(
      `insert into lit_grant (id,"updatedAt","userId","groupId","personId","projectId","typeId","recordId",level,"hideAmounts")
       values ($1,now(),$2,$3,$4,$5,$6,$7,$8,$9)`,
      [`gr${seed}_${i}`, target[0], target[1], ...sc, r() < 0.5 ? 'WRITE' : 'READ', r() < 0.3],
    );
  }
}

// ---------- probing the database ----------
async function savepoint<T>(c: pg.Client, fn: () => Promise<T>): Promise<T> {
  await c.query('savepoint probe');
  try {
    return await fn();
  } finally {
    await c.query('rollback to savepoint probe');
    await c.query('release savepoint probe');
  }
}
async function setActor(c: pg.Client, role: string, uid: string) {
  await c.query(`select set_config('app.user_id', $1, true)`, [uid]);
  await c.query(`set local role ${role}`);
}
const ids = async (c: pg.Client, sql: string, col = 'id') =>
  (await c.query(sql)).rows.map((x) => x[col] as string);
const rowsKey = async (c: pg.Client, sql: string) =>
  (await c.query(sql)).rows.map((x) => Object.values(x).join('|'));
async function tryRun(
  c: pg.Client,
  sql: string,
  params: unknown[] = [],
): Promise<{ ok: boolean; rows: number; code?: string }> {
  await c.query('savepoint t');
  try {
    const res = await c.query(sql, params);
    return { ok: true, rows: res.rowCount ?? 0 };
  } catch (e) {
    return { ok: false, rows: 0, code: (e as { code?: string }).code };
  } finally {
    await c.query('rollback to savepoint t');
    await c.query('release savepoint t');
  }
}
const refused = (r: { ok: boolean; rows: number }) => !r.ok || r.rows === 0;

async function probeUser(
  c: pg.Client,
  w: World,
  e: Expected,
  rng: Rng,
  counters: { users: number },
) {
  const uid = e.userId;
  const L = (what: string, role: string) => `${what} [${role}, user ${uid || '(anonymous)'}]`;
  const activeOnly = new Set(w.records.filter((r) => r.status === 'ACTIVE').map((r) => r.id));
  const activeProj = new Set(w.projects.filter((p) => p.status === 'ACTIVE').map((p) => p.id));
  const inter = (s: Set<string>, keep: Set<string>) => [...s].filter((x) => keep.has(x));

  // ----- lit_app: sees and writes -----
  await setActor(c, 'lit_app', uid);
  compare(L('records visible', 'lit_app'), await ids(c, 'select id from lit_record'), e.recVisible);
  compare(
    L('projects visible', 'lit_app'),
    await ids(c, 'select id from lit_project'),
    e.projVisible,
  );
  compare(
    L('links visible', 'lit_app'),
    await rowsKey(c, 'select "projectId","recordId" from lit_project_record'),
    e.linkVisible,
  );
  compare(
    L('mentions visible', 'lit_app'),
    await ids(c, 'select id from lit_record_mention'),
    e.mentionVisible,
  );
  compare(L('users visible', 'lit_app'), await ids(c, 'select id from lit_user'), e.usersVisible);
  compare(L('types visible', 'lit_app'), await ids(c, 'select id from lit_type'), e.typesVisible);
  compare(
    L('groups visible', 'lit_app'),
    await ids(c, 'select id from lit_group'),
    e.groupsVisible,
  );
  compare(
    L('memberships visible', 'lit_app'),
    await rowsKey(c, 'select "groupId","userId" from lit_group_member'),
    e.membersVisible,
  );
  compare(
    L('grants visible', 'lit_app'),
    await ids(c, 'select id from lit_grant'),
    e.grantsVisible,
  );

  // amounts view: the row set, the masked set, canWrite, and the values themselves
  const truth = new Map(w.records.map((r) => [r.id, r]));
  const view = (
    await c.query(
      `select "recordId", masked, "canWrite", sum::text, hours::text, total::text from lit_record_amount`,
    )
  ).rows;
  compare(
    L('amount view rows', 'lit_app'),
    view.map((v) => v.recordId),
    e.recVisible,
  );
  compare(
    L('masked amounts', 'lit_app'),
    view.filter((v) => v.masked).map((v) => v.recordId),
    e.recMasked,
  );
  compare(
    L('view canWrite', 'lit_app'),
    view.filter((v) => v.canWrite).map((v) => v.recordId),
    e.recWritable,
  );
  const wrongValues = view.filter((v) => {
    const t = truth.get(v.recordId)!;
    return v.masked
      ? v.sum !== null || v.hours !== null || v.total !== null
      : v.sum !== t.sum || v.hours !== t.hours || v.total !== t.total;
  });
  expect(
    L('amount values (masked NULL, shown equal)', 'lit_app'),
    wrongValues.length === 0,
    `${wrongValues.length} rows`,
  );

  // writes, each rolled back. Delete probes need the FK triggers off (the owner is a superuser).
  const upd = async (sql: string) =>
    savepoint(c, async () => (await c.query(sql)).rows.map((x) => x.id as string));
  compare(
    L('records updatable', 'lit_app'),
    await upd('update lit_record set status = status returning id'),
    e.recWritable,
  );
  compare(
    L('projects updatable', 'lit_app'),
    await upd('update lit_project set status = status returning id'),
    e.projWritable,
  );
  compare(
    L('users updatable', 'lit_app'),
    await upd('update lit_user set status = status returning id'),
    e.usersWritable,
  );
  compare(
    L('types updatable', 'lit_app'),
    await upd('update lit_type set status = status returning id'),
    e.admin ? e.typesVisible : [],
  );
  compare(
    L('groups updatable', 'lit_app'),
    await upd('update lit_group set name = name returning id'),
    e.admin ? e.groupsVisible : [],
  );
  compare(
    L('grants updatable', 'lit_app'),
    await upd('update lit_grant set level = level returning id'),
    e.admin ? e.grantsVisible : [],
  );
  const del = async (sql: string, col = 'id') =>
    savepoint(c, async () => {
      await c.query(`reset role`);
      await c.query(`set local session_replication_role = replica`);
      await c.query(`set local role lit_app`);
      return (await c.query(sql)).rows.map((x) =>
        col === 'link' ? `${x.projectId}|${x.recordId}` : `${x[col]}`,
      );
    });
  compare(
    L('records deletable (= writable)', 'lit_app'),
    await del('delete from lit_record returning id'),
    e.recWritable,
  );
  compare(
    L('projects deletable (creator/assignee/admin)', 'lit_app'),
    await del('delete from lit_project returning id'),
    e.projWritable,
  );
  compare(
    L('links deletable', 'lit_app'),
    await del('delete from lit_project_record returning "projectId","recordId"', 'link'),
    e.linkWritable,
  );
  compare(
    L('mentions deletable (write source, read entity)', 'lit_app'),
    await del('delete from lit_record_mention returning id'),
    e.mentionWritable,
  );
  compare(
    L('users deletable', 'lit_app'),
    await del('delete from lit_user returning id'),
    e.admin ? e.usersVisible : [],
  );
  compare(
    L('types deletable', 'lit_app'),
    await del('delete from lit_type returning id'),
    e.admin ? e.typesVisible : [],
  );
  compare(
    L('groups deletable', 'lit_app'),
    await del('delete from lit_group returning id'),
    e.admin ? e.groupsVisible : [],
  );
  compare(
    L('grants deletable', 'lit_app'),
    await del('delete from lit_grant returning id'),
    e.admin ? e.grantsVisible : [],
  );
  compare(
    L('memberships deletable', 'lit_app'),
    await savepoint(c, async () =>
      (await c.query('delete from lit_group_member returning "groupId","userId"')).rows.map(
        (x) => `${x.groupId}|${x.userId}`,
      ),
    ),
    e.admin ? e.membersVisible : [],
  );

  // link inserts: random pairs (denials) plus pairs built from what the oracle says is writable (allows)
  const linked = new Set(w.links.map((l) => `${l.projectId}|${l.recordId}`));
  const recIds = w.records.map((r) => r.id);
  const projIds = w.projects.map((p) => p.id);
  if (recIds.length && projIds.length) {
    const wr = [...e.recWritable];
    const vp = [...e.projVisible];
    const pairs: [string, string][] = [];
    for (let i = 0; i < 12; i++) pairs.push([pick(rng, projIds), pick(rng, recIds)]);
    if (wr.length && vp.length)
      for (let i = 0; i < 12; i++) pairs.push([pick(rng, vp), pick(rng, wr)]);
    for (const [p, r] of pairs) {
      if (linked.has(`${p}|${r}`)) continue;
      const res = await tryRun(
        c,
        `insert into lit_project_record ("projectId","recordId") values ($1,$2)`,
        [p, r],
      );
      expect(
        L(`link insert ${p}->${r}`, 'lit_app'),
        res.ok === (e.admin || (e.recWritable.has(r) && e.linkable(p))),
        JSON.stringify(res),
      );
    }
  }
  // mention inserts: random pairs (denials, among them planted mentions of invisible records)
  // plus pairs built from what the oracle says is allowed (writable source, visible entity)
  if (recIds.length) {
    const wr = [...e.recWritable];
    const vis = [...e.recVisible];
    const pairs: [string, string][] = [];
    for (let i = 0; i < 12; i++) pairs.push([pick(rng, recIds), pick(rng, recIds)]);
    if (wr.length && vis.length)
      for (let i = 0; i < 12; i++) pairs.push([pick(rng, wr), pick(rng, vis)]);
    let k = 0;
    for (const [src, ent] of pairs) {
      const res = await tryRun(
        c,
        `insert into lit_record_mention (id,"sourceId","entityId","start","end") values ($1,$2,$3,0,1)`,
        [`probe_m${k++}`, src, ent],
      );
      expect(
        L(`mention insert ${src}->${ent}`, 'lit_app'),
        res.ok === (e.admin || (e.recWritable.has(src) && e.recVisible.has(ent))),
        JSON.stringify(res),
      );
    }
  }
  // a mention is never updated (no grant), whatever the user may write
  {
    const res = await tryRun(c, `update lit_record_mention set "start" = "start"`);
    expect(
      L('mention update refused', 'lit_app'),
      !res.ok && res.code === '42501',
      JSON.stringify(res),
    );
  }
  // editing a record's text drops ALL its mentions, those of entities the editor cannot see too
  {
    const mentioned = new Set(w.mentions.map((m) => m.sourceId));
    const src = [...e.recWritable].find((id) => mentioned.has(id));
    if (src) {
      const left = await savepoint(c, async () => {
        await c.query(`update lit_record set text = coalesce(text, '') || 'x' where id = $1`, [
          src,
        ]);
        await c.query('reset role');
        return Number(
          (
            await c.query(`select count(*)::int n from lit_record_mention where "sourceId" = $1`, [
              src,
            ])
          ).rows[0].n,
        );
      });
      expect(L(`text edit drops mentions of ${src}`, 'lit_app'), left === 0, `${left} left`);
      await setActor(c, 'lit_app', uid);
    }
  }
  // creating rows: an active user may create own records/projects (with RETURNING, as Prisma does)
  if (w.typeIds.length) {
    const res = await tryRun(
      c,
      `insert into lit_record (id,"updatedAt","typeId","creatorId") values ('probe_r',now(),$1,$2) returning id`,
      [w.typeIds[0], uid || null],
    );
    expect(
      L('record insert as self', 'lit_app'),
      res.ok === e.active && (!e.active || res.rows === 1),
      JSON.stringify(res),
    );
  }
  const resp = await tryRun(
    c,
    `insert into lit_project (id,"updatedAt",code,"creatorId") values ('probe_p',now(),'probe_code',$1) returning id`,
    [uid || null],
  );
  expect(
    L('project insert as self', 'lit_app'),
    resp.ok === e.active && (!e.active || resp.rows === 1),
    JSON.stringify(resp),
  );

  // ----- lit_gateway: reads only, active records and projects only -----
  await c.query('reset role');
  await setActor(c, 'lit_gateway', uid);
  compare(
    L('records visible', 'lit_gateway'),
    await ids(c, 'select id from lit_record'),
    inter(e.recVisible, activeOnly),
  );
  compare(
    L('projects visible', 'lit_gateway'),
    await ids(c, 'select id from lit_project'),
    inter(e.projVisible, activeProj),
  );
  compare(
    L('links visible', 'lit_gateway'),
    await rowsKey(c, 'select "projectId","recordId" from lit_project_record'),
    [...e.linkVisible].filter((k) => {
      const [p, r] = k.split('|');
      return activeProj.has(p) && activeOnly.has(r);
    }),
  );
  compare(
    L('mentions visible', 'lit_gateway'),
    await ids(c, 'select id from lit_record_mention'),
    w.mentions
      .filter(
        (m) =>
          e.mentionVisible.has(m.id) && activeOnly.has(m.sourceId) && activeOnly.has(m.entityId),
      )
      .map((m) => m.id),
  );
  compare(
    L('users visible', 'lit_gateway'),
    await ids(c, 'select id from lit_user'),
    e.usersVisible,
  );
  const gv = (
    await c.query(
      `select "recordId", masked, sum::text, hours::text, total::text from lit_record_amount`,
    )
  ).rows;
  compare(
    L('amount view rows', 'lit_gateway'),
    gv.map((v) => v.recordId),
    inter(e.recVisible, activeOnly),
  );
  compare(
    L('masked amounts', 'lit_gateway'),
    gv.filter((v) => v.masked).map((v) => v.recordId),
    inter(e.recMasked, activeOnly),
  );
  const gwrong = gv.filter((v) => {
    const t = truth.get(v.recordId)!;
    return v.masked
      ? v.sum !== null || v.hours !== null || v.total !== null
      : v.sum !== t.sum || v.hours !== t.hours || v.total !== t.total;
  });
  expect(L('amount values', 'lit_gateway'), gwrong.length === 0, `${gwrong.length} rows`);
  await c.query('reset role');
  counters.users++;
}

// ---------- negative checks ----------
async function negativeChecks(c: pg.Client, w: World, oracle: (u: string) => Expected, rng: Rng) {
  const exps = w.users.map((u) => oracle(u.id));
  const nonAdmin = exps.filter((e) => e.active && !e.admin);
  const admin = exps.find((e) => e.admin);
  const inactive = w.users.filter((u) => u.status !== 'ACTIVE');
  const typeId = w.typeIds[0];

  // anonymous / unknown: empty everywhere, nothing insertable
  for (const who of ['', 'nobody-' + Math.floor(rng() * 1e6)]) {
    await setActor(c, 'lit_app', who);
    for (const t of [
      'lit_user',
      'lit_type',
      'lit_project',
      'lit_record',
      'lit_project_record',
      'lit_record_mention',
      'lit_group',
      'lit_group_member',
      'lit_grant',
    ]) {
      const n = Number((await c.query(`select count(*)::int n from ${t}`)).rows[0].n);
      expect(`anonymous sees nothing in ${t} (${who || 'empty id'})`, n === 0, `${n} rows`);
    }
    const v = Number((await c.query('select count(*)::int n from lit_record_amount')).rows[0].n);
    expect('anonymous sees no amount rows', v === 0);
    const ins = await tryRun(
      c,
      `insert into lit_record (id,"updatedAt","typeId") values ('x_anon',now(),$1)`,
      [typeId],
    );
    expect('anonymous cannot insert a record', !ins.ok);
    expect(
      'anonymous login picker still works',
      Number((await c.query('select count(*)::int n from lit_login_users()')).rows[0].n) > 0,
    );
    expect(
      'anonymous lit_record_ids() empty',
      Number((await c.query(`select count(*)::int n from lit_record_ids('read')`)).rows[0].n) === 0,
    );
    await c.query('reset role');
  }
  // the owner connection without lit_app is unchanged (reads everything)
  expect(
    'owner (no role) still sees all records',
    Number((await c.query('select count(*)::int n from lit_record')).rows[0].n) ===
      w.records.length,
  );

  // inactive users (admins included): empty and cannot write
  for (const u of inactive) {
    await setActor(c, 'lit_app', u.id);
    for (const t of ['lit_user', 'lit_record', 'lit_project', 'lit_grant', 'lit_record_mention']) {
      const n = Number((await c.query(`select count(*)::int n from ${t}`)).rows[0].n);
      expect(`inactive ${u.id}${u.isAdmin ? ' (admin)' : ''} sees nothing in ${t}`, n === 0);
    }
    const ins = await tryRun(
      c,
      `insert into lit_record (id,"updatedAt","typeId","creatorId") values ('x_inact',now(),$1,$2)`,
      [typeId, u.id],
    );
    expect(`inactive ${u.id} cannot insert`, !ins.ok);
    const up = await tryRun(c, `update lit_record set status = status`);
    expect(`inactive ${u.id} cannot update`, refused(up));
    await c.query('reset role');
  }

  // gateway: no write of any kind, no grant tables, no amount columns
  for (const t of [
    'lit_user',
    'lit_type',
    'lit_project',
    'lit_record',
    'lit_project_record',
    'lit_record_mention',
    'lit_group',
    'lit_group_member',
    'lit_grant',
  ]) {
    await setActor(c, 'lit_gateway', admin?.userId ?? '');
    const i =
      t === 'lit_record'
        ? `insert into lit_record (id,"updatedAt","typeId") values ('x_gw','2020-01-01',$1)`
        : null;
    const col =
      t === 'lit_project_record' ? '"recordId"' : t === 'lit_group_member' ? '"userId"' : 'id';
    for (const sql of [`update ${t} set ${col} = ${col}`, `delete from ${t}`, ...(i ? [i] : [])]) {
      const r = await tryRun(c, sql, sql.startsWith('insert') ? [typeId] : []);
      expect(`gateway cannot write: ${sql}`, !r.ok && r.code === '42501', JSON.stringify(r));
    }
    await c.query('reset role');
  }
  for (const t of ['lit_group', 'lit_group_member', 'lit_grant']) {
    await setActor(c, 'lit_gateway', admin?.userId ?? '');
    const r = await tryRun(c, `select * from ${t}`);
    expect(`gateway cannot read ${t}`, !r.ok && r.code === '42501', JSON.stringify(r));
    await c.query('reset role');
  }
  for (const role of ['lit_gateway', 'lit_app']) {
    await setActor(c, role, admin?.userId ?? '');
    for (const sql of [
      'select sum from lit_record',
      'select hours from lit_record',
      'select total from lit_record',
      'select * from lit_record',
      'select r.sum from lit_record r',
    ]) {
      const r = await tryRun(c, sql);
      expect(
        `${role} cannot read amounts directly: ${sql}`,
        !r.ok && r.code === '42501',
        JSON.stringify(r),
      );
    }
    await c.query('reset role');
  }

  // non-admin writes
  const sample1 = nonAdmin.slice(0, 6);
  for (const e of sample1) {
    const u = e.userId;
    const other = w.users.find((x) => x.id !== u)!.id;
    await setActor(c, 'lit_app', u);
    const T = (n: string) => `non-admin ${u}: ${n}`;
    expect(
      T('insert type'),
      refused(
        await tryRun(c, `insert into lit_type (id,"updatedAt",code) values ('x_t',now(),'x_t')`),
      ),
    );
    expect(T('update type'), refused(await tryRun(c, `update lit_type set color = '#111111'`)));
    expect(T('delete type'), refused(await tryRun(c, `delete from lit_type`)));
    expect(
      T('insert group'),
      refused(
        await tryRun(c, `insert into lit_group (id,"updatedAt",name) values ('x_g',now(),'x_g')`),
      ),
    );
    expect(
      T('insert membership'),
      refused(
        await tryRun(
          c,
          `insert into lit_group_member ("groupId","userId") select id, $1 from lit_group limit 1`,
          [u],
        ),
      ) || w.groupIds.length === 0,
    );
    expect(
      T('grant itself access (user target)'),
      refused(
        await tryRun(
          c,
          `insert into lit_grant (id,"updatedAt","userId","typeId",level) values ('x_gr',now(),$1,$2,'WRITE')`,
          [u, typeId],
        ),
      ),
    );
    expect(
      T('grant to another (record scope)'),
      refused(
        await tryRun(
          c,
          `insert into lit_grant (id,"updatedAt","userId","recordId",level) values ('x_gr',now(),$1,$2,'WRITE')`,
          [other, w.records[0].id],
        ),
      ),
    );
    expect(T('update grants'), refused(await tryRun(c, `update lit_grant set level = 'WRITE'`)));
    expect(T('delete grants'), refused(await tryRun(c, `delete from lit_grant`)));
    expect(
      T('set isAdmin on self'),
      refused(await tryRun(c, `update lit_user set "isAdmin" = true where id = $1`, [u])),
    );
    expect(
      T('set status on self'),
      refused(await tryRun(c, `update lit_user set status = 'INACTIVE' where id = $1`, [u])),
    );
    expect(
      T('change own username'),
      refused(await tryRun(c, `update lit_user set username = username || 'x' where id = $1`, [u])),
    );
    expect(
      T('edit another user'),
      refused(await tryRun(c, `update lit_user set name = 'x' where id = $1`, [other])),
    );
    expect(T('delete a user'), refused(await tryRun(c, `delete from lit_user`)));
    const own = await tryRun(c, `update lit_user set bio = 'hello' where id = $1`, [u]);
    expect(T('may edit own profile'), own.ok && own.rows === 1);
    const wr = [...e.recWritable];
    if (wr.length) {
      expect(
        T('change creatorId of a writable record'),
        refused(
          await tryRun(
            c,
            `update lit_record set "creatorId" = case when "creatorId" is not distinct from $2 then null else $2 end where id = $1`,
            [wr[0], other],
          ),
        ),
      );
      expect(
        T('set hidden on a writable record'),
        refused(await tryRun(c, `update lit_record set hidden = true where id = $1`, [wr[0]])),
      );
      expect(
        T('delete follows write set'),
        (await tryRun(c, `update lit_record set note = note where id = $1`, [wr[0]])).rows === 1,
      );
    }
    expect(
      T('insert a record with another creator'),
      refused(
        await tryRun(
          c,
          `insert into lit_record (id,"updatedAt","typeId","creatorId") values ('x_oc',now(),$1,$2)`,
          [typeId, other],
        ),
      ),
    );
    expect(
      T('insert a hidden record'),
      refused(
        await tryRun(
          c,
          `insert into lit_record (id,"updatedAt","typeId","creatorId",hidden) values ('x_h',now(),$1,$2,true)`,
          [typeId, u],
        ),
      ),
    );
    expect(
      T('insert a project with another creator'),
      refused(
        await tryRun(
          c,
          `insert into lit_project (id,"updatedAt",code,"creatorId") values ('x_pc',now(),'x_pc',$1)`,
          [other],
        ),
      ),
    );
    const wp = [...e.projWritable];
    if (wp.length)
      expect(
        T('change creatorId of a project'),
        refused(
          await tryRun(
            c,
            `update lit_project set "creatorId" = case when "creatorId" is not distinct from $2 then null else $2 end where id = $1`,
            [wp[0], other],
          ),
        ),
      );
    // amounts: writing a masked amount is refused; a masked record can still be written otherwise
    const masked = [...e.recMasked].filter((id) => e.recWritable.has(id));
    if (masked.length)
      expect(
        T('write a masked amount'),
        refused(await tryRun(c, `update lit_record set sum = 1 where id = $1`, [masked[0]])),
      );
    await c.query('reset role');
  }
  // an admin may do the same things (positive controls)
  if (admin) {
    await setActor(c, 'lit_app', admin.userId);
    const a = (n: string, r: { ok: boolean }) => expect(`admin: ${n}`, r.ok);
    a(
      'insert group',
      await tryRun(c, `insert into lit_group (id,"updatedAt",name) values ('x_g',now(),'x_g')`),
    );
    a(
      'insert grant',
      await tryRun(
        c,
        `insert into lit_grant (id,"updatedAt","userId","typeId",level) values ('x_gr',now(),$1,$2,'READ')`,
        [admin.userId, typeId],
      ),
    );
    a(
      'insert type',
      await tryRun(c, `insert into lit_type (id,"updatedAt",code) values ('x_t',now(),'x_t')`),
    );
    const rr = await tryRun(
      c,
      `update lit_record set hidden = true, "creatorId" = $1 where id = $2`,
      [admin.userId, w.records[0].id],
    );
    a('hide a record and set creator', rr);
    await c.query('reset role');
  }
}

// ---------- environment ----------
function sh(
  cmd: string,
  argv: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
) {
  const r = spawnSync(cmd, argv, {
    cwd: opts.cwd ?? root,
    env: { ...process.env, SHADOW_DATABASE_URL: undefined, ...opts.env },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} failed\n${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
}

async function startContainer() {
  const name = `lit-rls-oracle-${process.pid}`;
  for (let port = 5490; port <= 5499; port++) {
    const r = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '-d',
        '--name',
        name,
        '-e',
        'POSTGRES_PASSWORD=pw',
        '-p',
        `127.0.0.1:${port}:5432`,
        'postgres:17-alpine',
      ],
      { encoding: 'utf8' },
    );
    if (r.status === 0) {
      for (let i = 0; i < 60; i++) {
        if (
          spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' })
            .status === 0
        ) {
          await new Promise((s) => setTimeout(s, 1500));
          return { name, url: `postgresql://postgres:pw@127.0.0.1:${port}/postgres` };
        }
        await new Promise((s) => setTimeout(s, 500));
      }
      throw new Error('postgres did not start');
    }
  }
  throw new Error('no free port in 5490-5499');
}

const GENERATED = { users: 14, types: 9, projects: 18, records: 450 };
async function loadGenerated(c: pg.Client) {
  const r = mulberry32(4242);
  const users = Array.from({ length: GENERATED.users }, (_, i) => `u${i}`);
  for (const u of users)
    await c.query(`insert into lit_user (id,"updatedAt",username,name) values ($1,now(),$1,$1)`, [
      u,
    ]);
  const types = Array.from({ length: GENERATED.types }, (_, i) => `t${i}`);
  for (const t of types)
    await c.query(`insert into lit_type (id,"updatedAt",code) values ($1,now(),$1)`, [t]);
  const projects = Array.from({ length: GENERATED.projects }, (_, i) => `p${i}`);
  for (const p of projects)
    await c.query(
      `insert into lit_project (id,"updatedAt",code,"creatorId","assigneeId") values ($1,now(),$1,$2,$3)`,
      [p, r() < 0.9 ? pick(r, users) : null, r() < 0.5 ? pick(r, users) : null],
    );
  for (let i = 0; i < GENERATED.records; i++) {
    const id = `r${i}`;
    await c.query(
      `insert into lit_record (id,"updatedAt","typeId","creatorId","assigneeId",title) values ($1,now(),$2,$3,$4,$1)`,
      [id, pick(r, types), r() < 0.92 ? pick(r, users) : null, r() < 0.5 ? pick(r, users) : null],
    );
    for (const p of sample(r, projects, int(r, 0, 3)))
      await c.query(`insert into lit_project_record ("projectId","recordId") values ($1,$2)`, [
        p,
        id,
      ]);
  }
}

async function runMode(
  serverUrl: string,
  mode: 'generated' | 'franklin',
  seeds: number,
  log: (s: string) => void,
) {
  const dbName = `lit_rls_${mode}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();
  const url = withDb(serverUrl, dbName);
  assertThrowaway(url);
  const env = { DATABASE_URL: url, DIRECT_URL: url };
  log(`[${mode}] migrate deploy`);
  sh('bunx', ['prisma', 'migrate', 'deploy'], { env });
  if (mode === 'franklin') {
    log(`[${mode}] loading Franklin seeds (bun run seed)`);
    sh('bun', ['run', 'seed', '--db', `${url}${url.includes('?') ? '&' : '?'}schema=public`], {
      cwd: seedsDir,
      env,
    });
  }
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  if (mode === 'generated') await loadGenerated(c);
  const base = await loadWorld(c);
  log(
    `[${mode}] data: ${base.users.length} users, ${base.records.length} records, ${base.projects.length} projects, ${base.links.length} links, ${base.mentions.length} mentions`,
  );

  const counters = { users: 0 };
  const setsBefore = comparisons;
  for (let seed = FROM; seed < FROM + seeds; seed++) {
    const failBefore = failures;
    await c.query('begin');
    try {
      await applyOverlay(c, base, seed);
      const w = await loadWorld(c);
      const oracle = buildOracle(w);
      const rng = mulberry32(seed * 31 + 7);
      for (const u of [...w.users.map((x) => x.id), ''])
        await probeUser(c, w, oracle(u), rng, counters);
      await negativeChecks(c, w, oracle, rng);
      log(
        `[${mode}] seed ${seed}: ${w.users.length} users (${w.users.filter((x) => x.isAdmin).length} admin, ${w.users.filter((x) => x.status !== 'ACTIVE').length} inactive), ${w.grants.length} grants, ${w.groupIds.length} groups, mismatches ${failures - failBefore}`,
      );
    } finally {
      await c.query('rollback');
    }
  }
  await c.end();
  log(`[${mode}] done: ${counters.users} user probes, ${comparisons - setsBefore} comparisons`);
}

// ---------- main ----------
(async () => {
  const log = (s: string) => console.log(s);
  let container: { name: string; url: string } | undefined;
  let serverUrl = arg('db');
  try {
    if (serverUrl) assertThrowaway(serverUrl);
    else {
      container = await startContainer();
      serverUrl = container.url;
    }
    // the server url must also look like a throwaway host/port (database name is checked per mode)
    const modes: ('generated' | 'franklin')[] =
      dataMode === 'generated'
        ? ['generated']
        : dataMode === 'franklin'
          ? ['franklin']
          : ['generated', 'franklin'];
    for (const m of modes) {
      if (m === 'franklin' && !existsSync(seedsDir)) {
        log(`[franklin] skipped: ${seedsDir} not found`);
        continue;
      }
      await runMode(serverUrl!, m, m === 'generated' ? SEEDS : FRANKLIN_SEEDS, log);
    }
  } finally {
    if (container && !keep) spawnSync('docker', ['rm', '-f', container.name]);
  }
  console.log(
    `\n${comparisons} checks, ${elementsCompared} elements compared, ${failures} mismatches`,
  );
  for (const m of mismatchLog) console.log(m);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
