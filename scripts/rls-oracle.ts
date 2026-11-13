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
const HISTORY_RECORDS = Number(arg('history-records', '2')); // random records read per user per seed, on top of the special ones
const mutate = arg('mutate'); // plant a bug in lit_record_history of the throwaway db, to see the oracle catch it

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

// ---------- record history ----------
// The oracle's data is loaded by the owner, so it has NO history (writes with no acting user are
// not captured). History is made here the way the app makes it: writes as lit_app with
// app.user_id set. Every write that succeeded is logged in TS (HState.log), and the history the
// database should hold is derived from that log alone. lit_history is never read to build an
// expectation; it is read (as the owner) once, to check that the loaded data made none.
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Rec = Record<string, Json>;
const TS = '<ts>'; // createdAt/updatedAt values are unknowable: only their presence is compared
const AMOUNT_COLS = new Set(['sum', 'hours', 'total']);
const LINK_COLS = ['projectId', 'recordId'];
type HEntry = {
  group: number; // one SQL statement: the rows it caused may be written in any order
  table: 'lit_record' | 'lit_project_record';
  entity: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'REDACT';
  data: Rec;
  changed: string[] | null;
  actor: string;
  hiddenAtWrite?: boolean; // links: was the record hidden when the link was written
  stamp?: Stamp; // lit_record rows: where data.updatedAt came from
};
// Timestamps are canonical in the model, but a redaction matches values exactly. All of a
// seed's writes run in one transaction, so every save writes the same now(): an updatedAt is
// either the loaded one ('orig') or that now() ('now').
type Stamp = 'orig' | 'now';
type HState = {
  recCols: string[];
  rows: Map<string, Rec>; // the live records, as the model believes them to be
  links: Set<string>; // "projectId|recordId"
  log: HEntry[];
  group: number;
  touched: Set<string>; // record ids with any attempted write
  forced: Set<string>; // records of the forced scenarios: always read
  deleted: Set<string>; // deleted by an app write (history has a DELETE row)
  ownerDeleted: Set<string>; // deleted by the owner (only link history, if any)
  // values redacted per record and field: a later snapshot holding one of them shows null
  redacted: Map<string, Map<string, Json[]>>;
  stamp: Map<string, Stamp>; // live records' updatedAt source (absent = 'orig')
  applied: number;
  refused: number;
};
let historyChecks = 0;
let historyRows = 0;

const eqJson = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
function canonData(d: Rec, keep?: Set<string>) {
  const o: Rec = {};
  for (const k of Object.keys(d).sort()) {
    if (keep && !keep.has(k)) continue;
    o[k] = (k === 'createdAt' || k === 'updatedAt') && d[k] !== null ? TS : d[k];
  }
  return o;
}
const canonRow = (
  t: string,
  a: string,
  d: Rec,
  ch: string[] | null,
  actor: string | null,
  keep?: Set<string>,
) => JSON.stringify([t, a, canonData(d, keep), ch, actor]);

async function loadHistoryState(c: pg.Client): Promise<HState> {
  const rows = new Map<string, Rec>();
  for (const x of (await c.query(`select to_jsonb(r) as j from lit_record r`)).rows) {
    const j = x.j as Rec;
    for (const k of ['createdAt', 'updatedAt']) if (j[k] !== null) j[k] = TS;
    rows.set(j.id as string, j);
  }
  return {
    recCols: (
      await c.query(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'lit_record' order by ordinal_position`,
      )
    ).rows.map((x) => x.column_name as string),
    rows,
    links: new Set(
      (await c.query(`select "projectId","recordId" from lit_project_record`)).rows.map(
        (x) => `${x.projectId}|${x.recordId}`,
      ),
    ),
    log: [],
    group: 0,
    touched: new Set(),
    forced: new Set(),
    deleted: new Set(),
    ownerDeleted: new Set(),
    redacted: new Map(),
    stamp: new Map(),
    applied: 0,
    refused: 0,
  };
}

// A write as an app user. A refusal (an error, or no row visible to the write) is recorded as
// refused and changes nothing in the model.
async function attempt(c: pg.Client, uid: string, sql: string, params: unknown[] = []) {
  await c.query('reset role');
  await setActor(c, 'lit_app', uid);
  await c.query('savepoint h');
  try {
    const res = await c.query(sql, params);
    await c.query('release savepoint h');
    return { ok: true, rows: res.rowCount ?? 0, code: undefined as string | undefined };
  } catch (e) {
    await c.query('rollback to savepoint h');
    await c.query('release savepoint h');
    return { ok: false, rows: 0, code: (e as { code?: string }).code };
  }
}

async function historyWorkload(
  c: pg.Client,
  w: World,
  S: HState,
  oracle: (u: string) => Expected,
  rng: Rng,
  seed: number,
) {
  const activeUsers = w.users.filter((u) => u.status === 'ACTIVE').map((u) => u.id);
  const admins = w.users.filter((u) => u.status === 'ACTIVE' && u.isAdmin).map((u) => u.id);
  if (!activeUsers.length || !w.typeIds.length) return;
  const projIds = w.projects.map((p) => p.id);
  const oc = new Map<string, Expected>();
  const o = (u: string) => oc.get(u) ?? (oc.set(u, oracle(u)), oc.get(u)!);
  let seq = 0;
  const val = () => `v${seed}_${seq++}`;

  // the working set: a few records of every kind, new ones are added as they are inserted
  const wset = new Set<string>();
  const recIds = w.records.map((r) => r.id);
  for (const id of sample(rng, recIds, Math.min(8, recIds.length))) wset.add(id);
  for (const id of sample(rng, [...new Set(w.links.map((l) => l.recordId))], 4)) wset.add(id);
  for (const id of sample(
    rng,
    w.records.filter((r) => r.hidden).map((r) => r.id),
    2,
  ))
    wset.add(id);
  for (const u of sample(rng, activeUsers, 3))
    for (const id of sample(rng, [...o(u).recWritable], 2)) wset.add(id);
  const live = () => [...wset].filter((id) => S.rows.has(id));
  const pickRec = (uid: string) => {
    const l = live();
    if (!l.length) return undefined;
    const wr = l.filter((id) => o(uid).recWritable.has(id));
    return wr.length && rng() < 0.85 ? pick(rng, wr) : pick(rng, l);
  };
  const pickProj = (uid: string) => {
    const lp = projIds.filter((p) => o(uid).linkable(p));
    return lp.length && rng() < 0.85
      ? pick(rng, lp)
      : projIds.length
        ? pick(rng, projIds)
        : undefined;
  };
  const refuse = () => {
    S.refused++;
    return false;
  };

  // what the capture trigger stores for a lit_record row: redacted values come out as null
  const snap = (rid: string, row: Rec): Rec => {
    const d = clone(row);
    const st = S.stamp.get(rid) ?? 'orig';
    for (const [f, vals] of S.redacted.get(rid) ?? []) {
      const v = f === 'updatedAt' ? st : d[f];
      if (d[f] !== null && vals.some((x) => eqJson(x, v))) d[f] = null;
    }
    return d;
  };
  const upd = async (uid: string, rid: string, set: Rec) => {
    const g = ++S.group;
    const keys = Object.keys(set);
    const sql = `update lit_record set ${keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')}${keys.length ? ', ' : ''}"updatedAt" = now() where id = $${keys.length + 1}`;
    const res = await attempt(c, uid, sql, [...keys.map((k) => set[k]), rid]);
    S.touched.add(rid);
    if (!res.ok || res.rows !== 1) return refuse();
    S.applied++;
    const row = S.rows.get(rid)!;
    const ch = keys.filter((k) => !eqJson(row[k], set[k]));
    for (const k of keys) row[k] = set[k];
    S.stamp.set(rid, 'now');
    if (ch.length)
      S.log.push({
        group: g,
        table: 'lit_record',
        entity: rid,
        action: 'UPDATE',
        data: snap(rid, row),
        stamp: 'now',
        changed: ch.sort(),
        actor: uid,
      });
    return true;
  };
  const linkAdd = async (uid: string, rid: string, pid: string) => {
    const g = ++S.group;
    const res = await attempt(
      c,
      uid,
      `insert into lit_project_record ("projectId","recordId") values ($1,$2)`,
      [pid, rid],
    );
    S.touched.add(rid);
    if (!res.ok || res.rows !== 1) return refuse();
    S.applied++;
    S.links.add(`${pid}|${rid}`);
    S.log.push({
      group: g,
      table: 'lit_project_record',
      entity: rid,
      action: 'INSERT',
      data: { projectId: pid, recordId: rid },
      changed: null,
      actor: uid,
      hiddenAtWrite: S.rows.get(rid)!.hidden as boolean,
    });
    return true;
  };
  const linkRemove = async (uid: string, rid: string, pid: string) => {
    const g = ++S.group;
    const res = await attempt(
      c,
      uid,
      `delete from lit_project_record where "projectId" = $1 and "recordId" = $2`,
      [pid, rid],
    );
    S.touched.add(rid);
    if (!res.ok || res.rows !== 1) return refuse();
    S.applied++;
    S.links.delete(`${pid}|${rid}`);
    S.log.push({
      group: g,
      table: 'lit_project_record',
      entity: rid,
      action: 'DELETE',
      data: { projectId: pid, recordId: rid },
      changed: null,
      actor: uid,
      hiddenAtWrite: S.rows.get(rid)!.hidden as boolean,
    });
    return true;
  };
  const insRec = async (uid: string) => {
    const g = ++S.group;
    const id = `h${seed}_${seq++}`;
    const admin = admins.includes(uid);
    const hidden = admin && rng() < 0.3;
    const creatorId = admin && rng() < 0.2 ? pick(rng, activeUsers) : uid;
    const typeId = pick(rng, w.typeIds);
    const title = val();
    const res = await attempt(
      c,
      uid,
      `insert into lit_record (id,"updatedAt","typeId","creatorId",title,hidden) values ($1,now(),$2,$3,$4,$5) returning id`,
      [id, typeId, creatorId, title, hidden],
    );
    S.touched.add(id);
    if (!res.ok || res.rows !== 1) return refuse();
    S.applied++;
    const row: Rec = Object.fromEntries(S.recCols.map((k) => [k, null]));
    Object.assign(row, {
      id,
      status: 'ACTIVE',
      references: [],
      hidden,
      typeId,
      creatorId,
      title,
      createdAt: TS,
      updatedAt: TS,
    });
    S.rows.set(id, row);
    S.stamp.set(id, 'now');
    wset.add(id);
    S.log.push({
      group: g,
      table: 'lit_record',
      entity: id,
      action: 'INSERT',
      data: clone(row),
      stamp: 'now',
      changed: null,
      actor: uid,
    });
    return true;
  };
  const delRec = async (uid: string, rid: string) => {
    const g = ++S.group;
    const res = await attempt(c, uid, `delete from lit_record where id = $1`, [rid]);
    S.touched.add(rid);
    if (!res.ok || res.rows !== 1) return refuse();
    S.applied++;
    const row = S.rows.get(rid)!;
    // the cascade: its links are deleted, the records pointing at it lose the pointer
    for (const k of [...S.links].filter((x) => x.split('|')[1] === rid).sort()) {
      S.links.delete(k);
      S.log.push({
        group: g,
        table: 'lit_project_record',
        entity: rid,
        action: 'DELETE',
        data: { projectId: k.split('|')[0], recordId: rid },
        changed: null,
        actor: uid,
        hiddenAtWrite: row.hidden as boolean,
      });
    }
    for (const [cid, crow] of S.rows)
      if (cid !== rid && crow.recordId === rid) {
        crow.recordId = null;
        S.touched.add(cid);
        S.log.push({
          group: g,
          table: 'lit_record',
          entity: cid,
          action: 'UPDATE',
          data: snap(cid, crow),
          stamp: S.stamp.get(cid) ?? 'orig',
          changed: ['recordId'],
          actor: uid,
        });
      }
    S.log.push({
      group: g,
      table: 'lit_record',
      entity: rid,
      action: 'DELETE',
      data: snap(rid, row),
      stamp: S.stamp.get(rid) ?? 'orig',
      changed: null,
      actor: uid,
    });
    S.rows.delete(rid);
    S.deleted.add(rid);
    return true;
  };
  const hasRecordRows = (rid: string) =>
    S.log.some((x) => x.entity === rid && x.table === 'lit_record');
  const redact = async (uid: string, rid: string, given?: string[]) => {
    const g = ++S.group;
    const fields =
      given ??
      sample(
        rng,
        [
          'title',
          'note',
          'text',
          'description',
          'sum',
          'hours',
          'creatorId',
          'createdAt',
          'updatedAt',
        ],
        int(rng, 1, 3),
      );
    const res = await attempt(c, uid, `select lit_history_redact($1, $2::text[])`, [rid, fields]);
    S.touched.add(rid);
    expect(
      `redact of ${rid} by admin ${uid} is allowed exactly when the record has record history`,
      res.ok === hasRecordRows(rid),
      JSON.stringify(res),
    );
    if (!res.ok) return refuse();
    S.applied++;
    const fs = [...new Set(fields)].sort();
    // remember the values being redacted (snapshots and the live row), then null them
    const live = S.rows.get(rid);
    const mine = S.redacted.get(rid) ?? new Map<string, Json[]>();
    S.redacted.set(rid, mine);
    for (const f of fs) {
      const vals = mine.get(f) ?? [];
      mine.set(f, vals);
      const val = (d: Rec, st: Stamp | undefined) => (f === 'updatedAt' ? (st ?? 'orig') : d[f]);
      for (const x of S.log)
        if (x.table === 'lit_record' && x.entity === rid && x.action !== 'REDACT')
          if (x.data[f] !== null && x.data[f] !== undefined) vals.push(val(x.data, x.stamp));
      if (live && live[f] !== null && live[f] !== undefined) vals.push(val(live, S.stamp.get(rid)));
    }
    for (const x of S.log)
      if (x.table === 'lit_record' && x.entity === rid && x.action !== 'REDACT')
        for (const f of fs) x.data[f] = null;
    S.log.push({
      group: g,
      table: 'lit_record',
      entity: rid,
      action: 'REDACT',
      data: { fields: fs },
      changed: fs,
      actor: uid,
    });
    return true;
  };
  const amounts = (): Rec => {
    const s: Rec = {};
    if (rng() < 0.7) s.sum = int(rng, 1, 9999) + 0.5;
    if (rng() < 0.5) s.hours = int(rng, 0, 80) / 2;
    if (rng() < 0.5) s.total = int(rng, 0, 99999);
    if (!Object.keys(s).length) s.total = int(rng, 0, 99999);
    return s;
  };

  const OPS = 70;
  for (let i = 0; i < OPS; i++) {
    const uid = admins.length && rng() < 0.3 ? pick(rng, admins) : pick(rng, activeUsers);
    const roll = rng();
    const rid = pickRec(uid);
    if (roll < 0.1 || !rid) {
      await insRec(uid);
    } else if (roll < 0.3) {
      const set: Rec = {};
      for (const k of sample(rng, ['title', 'note', 'text', 'description'], int(rng, 1, 3)))
        set[k] = val();
      if (rng() < 0.15) set.status = S.rows.get(rid)!.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (rng() < 0.1) set.assigneeId = rng() < 0.3 ? null : pick(rng, activeUsers);
      if (rng() < 0.05) set.hidden = !S.rows.get(rid)!.hidden; // refused unless admin
      await upd(uid, rid, set);
    } else if (roll < 0.38) {
      // a save that changes nothing: with no column named, or the same values written back
      const row = S.rows.get(rid)!;
      await upd(uid, rid, rng() < 0.5 ? {} : { title: row.title, note: row.note });
    } else if (roll < 0.5) {
      await upd(uid, rid, amounts());
    } else if (roll < 0.55) {
      await upd(uid, rid, { title: val(), ...amounts() });
    } else if (roll < 0.67) {
      const pid = pickProj(uid);
      if (pid) await linkAdd(uid, rid, pid);
    } else if (roll < 0.75) {
      const mine = [...S.links].filter((k) => k.endsWith(`|${rid}`));
      if (mine.length) await linkRemove(uid, rid, pick(rng, mine).split('|')[0]);
    } else if (roll < 0.85 && admins.length) {
      // hide, work while hidden, un-hide, work again
      const a = pick(rng, admins);
      const nonAdminWriters = activeUsers.filter(
        (u) => !admins.includes(u) && o(u).recWritable.has(rid),
      );
      if (!S.rows.get(rid)!.hidden) await upd(a, rid, { hidden: true });
      await upd(a, rid, { note: val() });
      const p1 = pickProj(a);
      if (p1) await linkAdd(a, rid, p1);
      await upd(a, rid, { hidden: false });
      const wu = nonAdminWriters.length ? pick(rng, nonAdminWriters) : a;
      await upd(wu, rid, { title: val() });
      const p2 = pickProj(wu);
      if (p2) await linkAdd(wu, rid, p2);
    } else if (roll < 0.9) {
      await delRec(uid, rid);
    } else if (admins.length) {
      const target = pick(rng, [...S.touched]);
      await redact(pick(rng, admins), target);
    }
  }

  // ---- forced steps: scenarios the random mix may miss. Each runs on a record nothing has been
  // written to yet, so the scenario is not disturbed; every one is read by every user later.
  if (!admins.length || projIds.length < 2) return;
  const must = (what: string, ok: boolean) =>
    expect(`history workload: forced step ${what} was applied (seed ${seed})`, ok);
  const used = new Set<string>();
  const linked = new Set([...S.links].map((k) => k.split('|')[1]));
  const kids = new Set([...S.rows.values()].map((r) => r.recordId as string | null));
  const nonAdmins = w.users.filter((u) => u.status === 'ACTIVE' && !u.isAdmin).map((u) => o(u.id));
  const readers = (rid: string) => nonAdmins.filter((e) => e.recVisible.has(rid));
  const fresh = (score: (rid: string) => number) => {
    const cands = w.records
      .map((r) => r.id)
      .filter((id) => S.rows.get(id)?.hidden === false && !S.touched.has(id) && !used.has(id))
      .filter((id) => !kids.has(id) && !linked.has(id)) // no link yet: the scenarios add their own
      .sort();
    if (!cands.length) return undefined;
    const sc = cands.map((id) => [id, score(id)] as const);
    const best = Math.max(...sc.map((x) => x[1]));
    const id = pick(
      rng,
      sc.filter((x) => x[1] === best).map((x) => x[0]),
    );
    used.add(id);
    S.forced.add(id);
    return id;
  };
  // two projects a reader of the record can see (any two when there is none)
  const projPair = (rid: string) => {
    for (const e of readers(rid)) {
      const vis = projIds.filter((p) => e.projVisible.has(p));
      if (vis.length >= 2) return sample(rng, vis, 2);
    }
    return sample(rng, projIds, 2);
  };
  const withPairReader = (rid: string) =>
    readers(rid).some((e) => projIds.filter((p) => e.projVisible.has(p)).length >= 2) ? 1 : 0;
  const ownerHide = async (rid: string, hidden: boolean) => {
    await c.query('reset role');
    await c.query(`select set_config('app.user_id', '', true)`);
    await c.query(`update lit_record set hidden = $1 where id = $2`, [hidden, rid]);
    S.rows.get(rid)!.hidden = hidden; // an owner write: no history, the model still moves
  };
  const adm = () => pick(rng, admins);

  // (a) amounts-only edits, saves that change nothing, a mixed edit and a redaction, on a record
  // a masked and an unmasked non-admin can both read
  const ra = fresh((id) => {
    const rd = readers(id);
    return (
      (rd.some((e) => e.recMasked.has(id)) ? 2 : 0) + (rd.some((e) => !e.recMasked.has(id)) ? 1 : 0)
    );
  });
  if (ra) {
    const a = adm();
    const row = S.rows.get(ra)!;
    must('amounts-only edit', await upd(a, ra, { sum: 100.5 }));
    must('save with no column', await upd(a, ra, {}));
    must('save with the same values', await upd(a, ra, { title: row.title, sum: 100.5 }));
    must('mixed edit', await upd(a, ra, { title: val(), total: 7 }));
    must('second amounts-only edit', await upd(a, ra, { hours: 3.5 }));
    // an owner write puts a value in the live row that no snapshot holds; the redaction must
    // still keep it out of the next snapshot
    const pasted = `owner_${val()}`;
    await c.query('reset role');
    await c.query(`select set_config('app.user_id', '', true)`);
    await c.query(`update lit_record set description = $1 where id = $2`, [pasted, ra]);
    row.description = pasted;
    must('redaction', await redact(a, ra, ['description', 'note', 'sum', 'title']));
    must('edit after the redaction', await upd(a, ra, { title: val(), sum: 5.5 }));
  }

  // (b) a record the owner hid: linked while hidden, un-hidden by the app. No record row is
  // earlier than the link, so the hidden state comes from the later un-hide row.
  const rb = fresh(withPairReader);
  if (rb) {
    const a = adm();
    const [p1, p2] = projPair(rb);
    await ownerHide(rb, true);
    must('link while hidden', await linkAdd(a, rb, p1));
    must('un-hide', await upd(a, rb, { hidden: false }));
    must('link after un-hide', await linkAdd(a, rb, p2));
    const wu = nonAdmins.find((e) => e.recWritable.has(rb))?.userId ?? a;
    must('edit by a non-admin', await upd(wu, rb, { title: val() }));
  }

  // (c) the app hides a record and links it, then the owner un-hides it without a trace: the
  // hidden state of the link comes from the latest earlier record row (the hide itself)
  const rc = fresh(withPairReader);
  if (rc) {
    const a = adm();
    const [p1, p2] = projPair(rc);
    must('hide', await upd(a, rc, { hidden: true }));
    must('link while hidden by the app', await linkAdd(a, rc, p1));
    await ownerHide(rc, false);
    must('edit after the owner un-hid it', await upd(a, rc, { title: val() }));
    must('link when visible', await linkAdd(a, rc, p2));
    must('unlink the hidden-period link', await linkRemove(a, rc, p1));
  }

  // (d) a record the owner hid and the app linked and deleted while hidden: only the DELETE row
  // says it was hidden. A non-admin cannot read a deleted record, so lit_history_hidden_at is
  // checked directly (checkHistoryTable).
  const rd = fresh(() => 0);
  if (rd) {
    const a = adm();
    const [p1, p2] = projPair(rd);
    await ownerHide(rd, true);
    must('link while hidden (d1)', await linkAdd(a, rd, p1));
    must('link while hidden (d2)', await linkAdd(a, rd, p2));
    must('delete while hidden', await delRec(a, rd));
  }

  // (e) a record the owner hid and the app linked, never un-hidden: its state is the record's own
  const re = fresh(() => 0);
  if (re) {
    await ownerHide(re, true);
    must('link while hidden (e)', await linkAdd(adm(), re, projPair(re)[0]));
  }

  // (f) the owner hid a record; the app linked and edited it while hidden, the owner un-hid it
  // and the app hid it again. The nearest later row (the edit) says hidden; the first change of
  // hidden (the re-hide) would wrongly say the link was written while visible.
  const rf = fresh(() => 0);
  if (rf) {
    const a = adm();
    await ownerHide(rf, true);
    must('link while hidden (f)', await linkAdd(a, rf, projPair(rf)[0]));
    must('edit while hidden (f)', await upd(a, rf, { title: val() }));
    await ownerHide(rf, false);
    must('hide again (f)', await upd(a, rf, { hidden: true }));
  }
}

// The owner deletes a record whose only history is project links (made by an app user): no
// record row exists, the cascade is not captured, and the id must still not be reusable.
async function ownerDeleteLinkOnly(
  c: pg.Client,
  w: World,
  S: HState,
  rng: Rng,
  admins: string[],
  projIds: string[],
) {
  const hasChild = (rid: string) => [...S.rows.values()].some((r) => r.recordId === rid);
  const cands = [...S.rows.keys()].filter(
    (id) => !S.log.some((x) => x.entity === id && x.table === 'lit_record') && !hasChild(id),
  );
  if (!cands.length || !admins.length || !projIds.length) return;
  const rid = pick(rng, cands);
  if (!S.log.some((x) => x.entity === rid && x.table === 'lit_project_record')) {
    const g = ++S.group;
    const pid = pick(rng, projIds);
    const res = await attempt(
      c,
      admins[0],
      `insert into lit_project_record ("projectId","recordId") values ($1,$2)`,
      [pid, rid],
    );
    S.touched.add(rid);
    if (res.ok && res.rows === 1) {
      S.applied++;
      S.links.add(`${pid}|${rid}`);
      S.log.push({
        group: g,
        table: 'lit_project_record',
        entity: rid,
        action: 'INSERT',
        data: { projectId: pid, recordId: rid },
        changed: null,
        actor: admins[0],
        hiddenAtWrite: S.rows.get(rid)!.hidden as boolean,
      });
    } else S.refused++;
  }
  if (!S.log.some((x) => x.entity === rid)) return;
  await c.query('reset role');
  await c.query(`select set_config('app.user_id', '', true)`);
  await c.query(`delete from lit_record where id = $1`, [rid]);
  for (const k of [...S.links].filter((x) => x.split('|')[1] === rid)) S.links.delete(k);
  // With no record row and no record any more, lit_history_hidden_at has nothing to infer the
  // state from and answers false (the README's limit on owner writes), so that is what the
  // links written before count as.
  for (const x of S.log) if (x.entity === rid) x.hiddenAtWrite = false;
  S.rows.delete(rid);
  S.ownerDeleted.add(rid);
  S.touched.add(rid);
}

// What the database should return to this user for this record, newest first, as groups of
// canonical rows (rows written by one statement may come in any order). The rules are the
// README's "Record history": a non-admin reads only while the record is readable now, never a
// REDACT row, nothing from the hidden period, only the columns the app role may read (amounts
// when the amounts are theirs), project links only for readable projects and not from the
// time the record was hidden, and an update whose visible part is empty not at all.
function expectedHistory(S: HState, e: Expected, rid: string): string[][] {
  const groups: string[][] = [];
  if (!e.active) return groups;
  if (!e.admin && !e.recVisible.has(rid)) return groups;
  const recKeep = new Set(
    S.recCols.filter((k) => e.admin || !e.recMasked.has(rid) || !AMOUNT_COLS.has(k)),
  );
  const linkKeep = new Set(LINK_COLS);
  const shown = (en: HEntry): string | null => {
    if (e.admin) return canonRow(en.table, en.action, en.data, en.changed, en.actor);
    if (en.table === 'lit_record') {
      if (en.action === 'REDACT') return null;
      if (en.data.hidden === true || en.changed?.includes('hidden')) return null;
      const ch = en.changed ? en.changed.filter((k) => recKeep.has(k)) : null;
      if (en.action === 'UPDATE' && ch!.length === 0) return null;
      return canonRow(en.table, en.action, en.data, ch, en.actor, recKeep);
    }
    if (!e.projVisible.has(en.data.projectId as string) || en.hiddenAtWrite) return null;
    return canonRow(en.table, en.action, en.data, en.changed, en.actor, linkKeep);
  };
  const mine = S.log.filter((x) => x.entity === rid);
  let cur: string[] = [];
  let curGroup = -1;
  for (let i = mine.length - 1; i >= 0; i--) {
    if (mine[i].group !== curGroup) {
      if (cur.length) groups.push(cur);
      cur = [];
      curGroup = mine[i].group;
    }
    const r = shown(mine[i]);
    if (r) cur.push(r);
  }
  if (cur.length) groups.push(cur);
  return groups;
}

type DbHist = { id: string; canon: string };
async function readHistory(
  c: pg.Client,
  rid: string,
  before: string | null = null,
  max: number | null = 200,
): Promise<DbHist[]> {
  const res = await c.query(
    `select id::text, "tableName", action::text, data, changed, "actorId" from lit_record_history($1, $2::bigint, $3::int)`,
    [rid, before, max],
  );
  return res.rows.map((x) => ({
    id: x.id as string,
    canon: canonRow(x.tableName, x.action, x.data ?? {}, x.changed, x.actorId),
  }));
}

function compareHistory(label: string, got: string[], want: string[][]) {
  comparisons++;
  historyChecks++;
  const total = want.reduce((n, g) => n + g.length, 0);
  elementsCompared += Math.max(total, got.length);
  historyRows += got.length;
  let bad = '';
  if (got.length !== total) bad = `${got.length} rows from the db, ${total} from the oracle`;
  else {
    let pos = 0;
    for (const g of want) {
      const a = got.slice(pos, pos + g.length).sort();
      const b = g.slice().sort();
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        bad = `rows ${pos}-${pos + g.length - 1}: db ${a.join(' ; ')} <> oracle ${b.join(' ; ')}`;
        break;
      }
      pos += g.length;
    }
  }
  if (bad) {
    failures++;
    if (mismatchLog.length < 60) mismatchLog.push(`MISMATCH ${label}: ${bad.slice(0, 900)}`);
  }
}

async function checkHistory(
  c: pg.Client,
  w: World,
  oracle: (u: string) => Expected,
  S: HState,
  rng: Rng,
  seed: number,
) {
  // The records every user reads (each read costs a scan of the user's visible records): the
  // forced scenarios and the special cases (owner- and app-deleted, redacted, hidden at some
  // point) always, then HISTORY_RECORDS others of what was written (never fewer, whatever the
  // number of special ones), an untouched one (the loaded data made no history) and an
  // unknown id.
  const written = [...new Set(S.log.map((x) => x.entity))];
  // the forced scenarios already hold a deleted, a redacted, a hidden and a hidden-at-write
  // record; the random ones stand in only when a seed made no forced scenario
  const fallback = S.forced.size
    ? []
    : [
        ...[...S.deleted].slice(0, 1),
        ...S.log
          .filter((x) => x.action === 'REDACT')
          .map((x) => x.entity)
          .slice(0, 1),
        ...S.log
          .filter(
            (x) =>
              x.table === 'lit_record' && (x.data.hidden === true || x.changed?.includes('hidden')),
          )
          .map((x) => x.entity)
          .slice(0, 1),
        ...S.log
          .filter((x) => x.hiddenAtWrite)
          .map((x) => x.entity)
          .slice(0, 1),
      ];
  const special = new Set<string>([...S.forced, ...S.ownerDeleted, ...fallback]);
  const rest = written.filter((id) => !special.has(id));
  const check = [
    ...special,
    ...sample(rng, rest, HISTORY_RECORDS),
    ...sample(
      rng,
      w.records.map((r) => r.id).filter((id) => !S.touched.has(id)),
      1,
    ),
    'no_such_record',
  ];
  let userNo = 0;
  for (const u of [...w.users.map((x) => x.id), '', `nobody-${seed}`]) {
    const e = oracle(u);
    const edges = userNo++ % 3 === 0 || e.admin;
    const L = (what: string) => `history ${what} [user ${u || '(anonymous)'}, seed ${seed}]`;
    await c.query('reset role');
    await setActor(c, 'lit_app', u);
    let edgeDone = false;
    // who is not active sees nothing whatever the record: three reads are enough
    for (const rid of e.active ? check : check.slice(0, 3)) {
      const want = expectedHistory(S, e, rid);
      const total = want.reduce((n, g) => n + g.length, 0);
      const full = await readHistory(c, rid);
      compareHistory(
        L(`of ${rid}`),
        full.map((x) => x.canon),
        want,
      );
      const ids = full.map((x) => x.id);
      // paging: small pages walked with before_id must equal the whole list
      if (ids.length >= 2 && rng() < 0.2) {
        const size = int(rng, 1, 3);
        const walked: string[] = [];
        let before: string | null = null;
        for (let n = 0; n <= ids.length + 1; n++) {
          const page: DbHist[] = await readHistory(c, rid, before, size);
          if (!page.length) break;
          expect(L(`page of ${rid} holds at most ${size}`), page.length <= size);
          walked.push(...page.map((x) => x.id));
          before = page[page.length - 1].id;
        }
        comparisons++;
        historyChecks++;
        elementsCompared += ids.length;
        if (JSON.stringify(walked) !== JSON.stringify(ids)) {
          failures++;
          mismatchLog.push(
            `MISMATCH ${L(`pages of ${size} over ${rid}`)}: walked ${walked.length} ids, whole list ${ids.length}`,
          );
        }
      }
      // the argument edges, once per user on a record that has rows
      if (edges && !edgeDone && total >= 1) {
        edgeDone = true;
        expect(L('before_id 0 reads nothing'), (await readHistory(c, rid, '0', 200)).length === 0);
        expect(L('max_rows 0 reads one row'), (await readHistory(c, rid, null, 0)).length === 1);
        expect(
          L('max_rows NULL reads the default 50'),
          (await readHistory(c, rid, null, null)).length === Math.min(50, total),
        );
        expect(
          L('before_id past the end reads everything'),
          (await readHistory(c, rid, '9223372036854775807', 200)).length === total,
        );
      }
    }
  }
  await c.query('reset role');
}

// The table itself, read as the owner, against the log: the same rows (table, record, action,
// changed, actor) and, for project links, the project and the hidden state lit_history_hidden_at
// gives for each row against the state the record was in when it was written. The door only
// shows a non-admin the links of a record they can read now, so the hidden-at branches that
// only a deleted or still-hidden record reaches are seen here.
async function checkHistoryTable(c: pg.Client, S: HState, seed: number) {
  await c.query('reset role');
  await c.query(`select set_config('app.user_id', '', true)`);
  const rows = (
    await c.query(
      `select "tableName", "entityId", action::text, changed, "actorId", data ->> 'projectId' as pid,
              case when "tableName" = 'lit_project_record' then lit_history_hidden_at("entityId", id) end as hat
       from lit_history`,
    )
  ).rows;
  const got = rows
    .map((x) =>
      JSON.stringify([x.tableName, x.entityId, x.action, x.changed, x.actorId, x.pid, x.hat]),
    )
    .sort();
  const want = S.log
    .map((x) => {
      const link = x.table === 'lit_project_record';
      return JSON.stringify([
        x.table,
        x.entity,
        x.action,
        x.changed,
        x.actor,
        link ? x.data.projectId : null,
        link ? !!x.hiddenAtWrite : null,
      ]);
    })
    .sort();
  comparisons++;
  historyChecks++;
  elementsCompared += Math.max(got.length, want.length);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    const g = new Set(got);
    const wanted = new Set(want);
    const onlyDb = got.filter((x) => !wanted.has(x));
    const onlyLog = want.filter((x) => !g.has(x));
    mismatchLog.push(
      `MISMATCH history table against the write log [seed ${seed}]: ${got.length} rows in the db, ${want.length} in the log; only in the db: ${onlyDb.slice(0, 3).join(' ')}; only in the log: ${onlyLog.slice(0, 3).join(' ')}`,
    );
  }
}

async function historyNegatives(
  c: pg.Client,
  w: World,
  oracle: (u: string) => Expected,
  S: HState,
  seed: number,
) {
  const exps = w.users.map((u) => oracle(u.id));
  const admin = exps.find((e) => e.admin);
  const nonAdmin = exps.find((e) => e.active && !e.admin);
  const inactiveAdmin = w.users.find((u) => u.status !== 'ACTIVE' && u.isAdmin);
  const typeId = w.typeIds[0];
  const withHistory = [...S.touched].find((id) =>
    S.log.some((x) => x.entity === id && x.table === 'lit_record'),
  );
  const denied = (label: string, r: { ok: boolean; code?: string }, code = '42501') =>
    expect(`history negative: ${label}`, !r.ok && r.code === code, JSON.stringify(r));

  // the gateway cannot call the read door or the redaction; nobody can touch the table
  for (const [role, uid] of [
    ['lit_gateway', admin?.userId ?? ''],
    ['lit_app', admin?.userId ?? ''],
    ['lit_app', nonAdmin?.userId ?? ''],
  ] as const) {
    await c.query('reset role');
    await setActor(c, role, uid);
    if (role === 'lit_gateway') {
      denied(
        `${role} lit_record_history`,
        await tryRun(c, `select * from lit_record_history('x')`),
      );
      denied(
        `${role} lit_history_redact`,
        await tryRun(c, `select lit_history_redact('x', array['title'])`),
      );
    }
    for (const sql of [
      'select * from lit_history',
      'select count(*) from lit_history',
      `insert into lit_history ("tableName","entityId",action) values ('lit_record','x','INSERT')`,
      `update lit_history set "entityId" = "entityId"`,
      'delete from lit_history',
      `select nextval('lit_history_id_seq')`,
      `select lit_capture_history()`,
    ])
      denied(`${role} (${uid || 'anonymous'}) ${sql}`, await tryRun(c, sql));
  }
  // an id that has history cannot be taken again by an app write: deleted by an app write
  // (record rows), or deleted by the owner with only link rows
  const reuse = [...[...S.deleted].slice(0, 2), ...[...S.ownerDeleted].slice(0, 2)];
  for (const rid of reuse)
    for (const who of [admin?.userId, nonAdmin?.userId].filter(Boolean) as string[]) {
      await c.query('reset role');
      await setActor(c, 'lit_app', who);
      denied(
        `re-inserting the id ${rid} of a deleted record as ${who}`,
        await tryRun(
          c,
          `insert into lit_record (id,"updatedAt","typeId","creatorId") values ($1,now(),$2,$3)`,
          [rid, typeId, who],
        ),
        '23505',
      );
    }
  // redaction: admin only, needs record history, never id or hidden
  if (withHistory) {
    for (const who of [nonAdmin?.userId, inactiveAdmin?.id].filter(Boolean) as string[]) {
      await c.query('reset role');
      await setActor(c, 'lit_app', who);
      denied(
        `redact by ${who}`,
        await tryRun(c, `select lit_history_redact($1, array['title'])`, [withHistory]),
      );
    }
  }
  if (admin) {
    await c.query('reset role');
    await setActor(c, 'lit_app', admin.userId);
    if (withHistory) {
      for (const f of [['id'], ['hidden'], ['title', 'id'], ['nope'], []])
        denied(
          `admin redact of ${JSON.stringify(f)}`,
          await tryRun(c, `select lit_history_redact($1, $2::text[])`, [withHistory, f]),
          '22023',
        );
      denied(
        'admin redact with NULL fields',
        await tryRun(c, `select lit_history_redact($1, null)`, [withHistory]),
        '22023',
      );
    }
    denied(
      'admin redact of a record with no history',
      await tryRun(c, `select lit_history_redact($1, array['title'])`, [`never_${seed}`]),
      'P0002',
    );
  }
  await c.query('reset role');
}

async function historyPhase(c: pg.Client, w0: World, seed: number) {
  const rng = mulberry32(seed * 977 + 31);
  await c.query('reset role');
  // hide, un-hide and redact are admin writes: a seed whose admins are all inactive would get no
  // forced scenarios, so the owner re-activates one (the probes above ran on the overlay as drawn)
  let w = w0;
  if (!w.users.some((u) => u.isAdmin && u.status === 'ACTIVE')) {
    await c.query(
      `update lit_user set status = 'ACTIVE' where id = (select id from lit_user where "isAdmin" order by id limit 1)`,
    );
    w = await loadWorld(c);
  }
  // the data and the overlay were written by the owner: nothing of it is history
  expect(
    `history: owner-loaded data and overlay made no history (seed ${seed})`,
    Number((await c.query('select count(*)::int n from lit_history')).rows[0].n) === 0,
  );
  const S = await loadHistoryState(c);
  const pre = buildOracle(w);
  const t0 = Date.now();
  await historyWorkload(c, w, S, pre, rng, seed);
  const tWork = Date.now() - t0;
  const admins = w.users.filter((u) => u.status === 'ACTIVE' && u.isAdmin).map((u) => u.id);
  await ownerDeleteLinkOnly(
    c,
    w,
    S,
    rng,
    admins,
    w.projects.map((p) => p.id),
  );
  await c.query('reset role');
  await c.query(`select set_config('app.user_id', '', true)`);
  const w2 = await loadWorld(c); // the world as the writes left it
  const post = buildOracle(w2);
  const t1 = Date.now();
  await checkHistory(c, w2, post, S, rng, seed);
  const tReads = Date.now() - t1;
  await checkHistoryTable(c, S, seed);
  await historyNegatives(c, w2, post, S, seed);
  await c.query('reset role');
  return `${S.applied} writes applied, ${S.refused} refused, ${S.log.length} history rows expected over ${S.touched.size} records, ${S.forced.size} forced scenarios; writes ${(tWork / 1000).toFixed(1)}s, reads ${(tReads / 1000).toFixed(1)}s`;
}

// Mutation sanity: --mutate <name> rewrites lit_record_history in the throwaway database with
// one rule removed. The oracle must then fail (exit 1); a run that still passes means the
// oracle does not cover that rule.
type Mutation = { fn: string; from: string; to: string };
const door = 'lit_record_history(text,bigint,int)';
const hiddenAt = 'lit_history_hidden_at(text,bigint)';
const redactFn = 'lit_history_redact(text,text[])';
const capture = 'lit_capture_history()';
const MUTATIONS: Record<string, Mutation> = {
  // the read door
  'hidden-data': { fn: door, from: `COALESCE((h.data ->> 'hidden')::boolean, false)`, to: 'false' },
  'hidden-changed': { fn: door, from: `COALESCE('hidden' = ANY(h.changed), false)`, to: 'false' },
  'link-hidden-at': {
    fn: door,
    from: `AND NOT public.lit_history_hidden_at(h."entityId", h.id)`,
    to: '',
  },
  'link-project': {
    fn: door,
    from: `h.data ->> 'projectId' IN (SELECT public.lit_project_ids('read'))`,
    to: 'true',
  },
  redact: { fn: door, from: `AND (ok.adm OR h.action <> 'REDACT')`, to: '' },
  'masked-update': { fn: door, from: `WHERE p.action <> 'UPDATE' OR cardinality(p.c) > 0`, to: '' },
  'changed-mask': {
    fn: door,
    from: `ELSE ARRAY(SELECT k FROM unnest(h.changed) k WHERE k = ANY(cols.allowed)) END AS c`,
    to: 'ELSE h.changed END AS c',
  },
  'columns-allow-list': { fn: door, from: `WHERE e.key = ANY(cols.allowed)`, to: 'WHERE true' },
  'can-read': { fn: door, from: `AND (ok.adm OR ok.can_read)`, to: '' },
  'before-id': { fn: door, from: `AND (before_id IS NULL OR h.id < before_id)`, to: '' },
  // the capture trigger
  'noop-skip': { fn: capture, from: `IF ch IS NULL THEN RETURN NULL; END IF;`, to: '' },
  'd2-skip': { fn: capture, from: `IF actor IS NULL THEN RETURN NULL; END IF;`, to: '' },
  // an id with history cannot be taken again
  'id-reuse': { fn: 'lit_guard_record_insert()', from: `h."entityId" = NEW.id)`, to: 'false)' },
  'id-reuse-links': {
    fn: 'lit_guard_record_insert()',
    from: `IN ('lit_record', 'lit_project_record', 'lit_record_file')`,
    to: `IN ('lit_record')`,
  },
  // the hidden state of a link row, one branch removed at a time
  'hidden-at-earlier': {
    fn: hiddenAt,
    from: `AND h.action <> 'REDACT' AND h.id < row_id`,
    to: `AND h.action <> 'REDACT' AND h.id < 0`,
  },
  'hidden-at-infer': {
    fn: hiddenAt,
    from: `AND h.action IN ('UPDATE', 'DELETE') AND h.id > row_id`,
    to: `AND h.action IN ('UPDATE', 'DELETE') AND h.id < 0`,
  },
  // the later row must be the nearest one, not the first that changed hidden
  'hidden-at-nearest': {
    fn: hiddenAt,
    from: `AND h.action IN ('UPDATE', 'DELETE') AND h.id > row_id`,
    to: `AND h.action = 'UPDATE' AND 'hidden' = ANY(h.changed) AND h.id > row_id`,
  },
  'hidden-at-current': {
    fn: hiddenAt,
    from: `(SELECT r.hidden FROM public.lit_record r WHERE r.id = record_id)`,
    to: 'NULL::boolean',
  },
  // redaction
  'redact-body': {
    fn: redactFn,
    from: `SET data = h.data || (SELECT jsonb_object_agg(f, 'null'::jsonb) FROM unnest(fs) f)`,
    to: 'SET data = h.data',
  },
  'redact-admin-only': {
    fn: redactFn,
    from: `IF admin_id IS NULL OR NOT public.lit_current_user_is_admin() THEN`,
    to: 'IF admin_id IS NULL THEN',
  },
  'redact-id-hidden': {
    fn: redactFn,
    from: `IF 'id' = ANY(fs) OR 'hidden' = ANY(fs) THEN`,
    to: 'IF false THEN',
  },
  'redact-columns': {
    fn: redactFn,
    from: `IF EXISTS (SELECT 1 FROM unnest(fs) f`,
    to: 'IF false AND EXISTS (SELECT 1 FROM unnest(fs) f',
  },
  'redact-needs-history': {
    fn: redactFn,
    from: `IF NOT EXISTS (SELECT 1 FROM public.lit_history h`,
    to: 'IF false AND NOT EXISTS (SELECT 1 FROM public.lit_history h',
  },
  // a redaction sticks: later snapshots keep redacted values out, the live one included
  'redact-sticks': {
    fn: capture,
    from: `IF TG_TABLE_NAME = 'lit_record' THEN`,
    to: 'IF false THEN',
  },
  'redact-live': {
    fn: redactFn,
    from: `WHERE r.id = record_id`,
    to: 'WHERE false',
  },
};
async function plantMutation(c: pg.Client, name: string) {
  const m = MUTATIONS[name];
  if (!m) throw new Error(`unknown mutation ${name}; one of ${Object.keys(MUTATIONS).join(', ')}`);
  const def = (await c.query(`select pg_get_functiondef($1::regprocedure) as d`, [m.fn])).rows[0]
    .d as string;
  if (!def.includes(m.from)) throw new Error(`mutation ${name}: text not found in ${m.fn}`);
  await c.query(def.replace(m.from, () => m.to));
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
  if (mutate) await plantMutation(c, mutate);
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
      const tHist = Date.now();
      const hist = await historyPhase(c, w, seed);
      const histMs = Date.now() - tHist;
      log(
        `[${mode}] seed ${seed}: ${w.users.length} users (${w.users.filter((x) => x.isAdmin).length} admin, ${w.users.filter((x) => x.status !== 'ACTIVE').length} inactive), ${w.grants.length} grants, ${w.groupIds.length} groups, mismatches ${failures - failBefore}; history: ${hist} (${(histMs / 1000).toFixed(1)}s)`,
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
    `\n${comparisons} checks (${historyChecks} of them history reads, ${historyRows} history rows compared), ${elementsCompared} elements compared, ${failures} mismatches`,
  );
  for (const m of mismatchLog) console.log(m);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
