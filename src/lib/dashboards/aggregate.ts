import { parseLatLng } from '$lib/fields/registry';
import type {
  Correspondent,
  DashboardData,
  DashboardRecord,
  DashboardUser,
  GeoRoute,
  MoneyTotal,
  ProjectCount,
  TypeCount,
  YearCount,
} from './types';

/** A record row as loaded from the DB, before the user's `role` is known. */
export type RawDashboardRecord = Omit<DashboardRecord, 'role'>;

const LIST_LIMIT = 10;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const tokens = (s: string) =>
  s
    .split(' ')
    .map((t) => t.replace(/\./g, ''))
    .filter(Boolean);

/** Shortest name word that may identify someone on its own ("Li" is too short). */
const MIN_NAME_WORD = 3;

/** Every word of `part` is a whole word of `whole` and is long enough to mean something. */
const wordsWithin = (part: string[], whole: string[]) =>
  part.length > 0 && part.every((t) => t.length >= MIN_NAME_WORD && whole.includes(t));

/** Does a free-text letter party name refer to the signed-in user? Tolerant of
 *  case, whitespace and partial names (a surname, or "B. Smith" for "Ben Smith"),
 *  matching whole words only. An empty user name matches nobody. */
export function isSelf(
  name: string | null | undefined,
  user: Pick<DashboardUser, 'name'>,
): boolean {
  if (!name) return false;
  const n = norm(name);
  const me = norm(user.name);
  if (!n || !me) return false;
  if (n === me) return true;
  const nWords = tokens(n);
  const meWords = tokens(me);
  if (nWords.length === 0 || meWords.length === 0) return false;
  if (wordsWithin(nWords, meWords) || wordsWithin(meWords, nWords)) return true;
  // "B. Smith": same surname and a matching first initial.
  return (
    nWords.length > 1 &&
    meWords.length > 1 &&
    nWords[nWords.length - 1] === meWords[meWords.length - 1] &&
    nWords[0][0] === meWords[0][0]
  );
}

/** When a record "happened": its date, else its start; null when undated. */
const eventDate = (r: RawDashboardRecord) => r.date ?? r.start ?? null;
const sortKey = (r: RawDashboardRecord) => (eventDate(r) ?? r.createdAt).getTime();

function countsByType(records: DashboardRecord[]): TypeCount[] {
  const map = new Map<string, TypeCount>();
  for (const r of records) {
    let c = map.get(r.type.id);
    if (!c) {
      c = {
        typeId: r.type.id,
        code: r.type.code,
        color: r.type.color,
        iconSeed: r.type.iconSeed,
        count: 0,
        created: 0,
        assigned: 0,
      };
      map.set(r.type.id, c);
    }
    c.count += 1;
    if (r.role !== 'assignee') c.created += 1;
    if (r.role !== 'creator') c.assigned += 1;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function byYear(records: DashboardRecord[]): YearCount[] {
  const counts = new Map<number, number>();
  for (const r of records) {
    const d = eventDate(r);
    if (d) counts.set(d.getUTCFullYear(), (counts.get(d.getUTCFullYear()) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const years = [...counts.keys()];
  const out: YearCount[] = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    out.push({ year: y, count: counts.get(y) ?? 0 });
  }
  return out;
}

function correspondents(records: DashboardRecord[], user: DashboardUser): Correspondent[] {
  const map = new Map<string, Correspondent & { key: string }>();
  const touch = (name: string, dir: 'sent' | 'received' | null, when: Date | null) => {
    const key = norm(name);
    let c = map.get(key);
    if (!c) {
      c = { key, name: name.trim(), sent: 0, received: 0, total: 0, first: null, last: null };
      map.set(key, c);
    }
    c.total += 1;
    if (dir) c[dir] += 1;
    if (when) {
      if (!c.first || when < c.first) c.first = when;
      if (!c.last || when > c.last) c.last = when;
    }
  };
  for (const r of records) {
    const when = eventDate(r);
    const fromMe = isSelf(r.from, user);
    const toMe = isSelf(r.to, user);
    if (r.to?.trim() && !toMe) touch(r.to, fromMe ? 'sent' : null, when);
    if (r.from?.trim() && !fromMe) touch(r.from, toMe ? 'received' : null, when);
  }
  return [...map.values()]
    .map((c) => ({
      name: c.name,
      sent: c.sent,
      received: c.received,
      total: c.total,
      first: c.first,
      last: c.last,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function projectCounts(records: DashboardRecord[]): ProjectCount[] {
  const map = new Map<string, ProjectCount>();
  for (const r of records) {
    for (const { project } of r.projects) {
      const c = map.get(project.id) ?? { ...project, count: 0 };
      c.count += 1;
      map.set(project.id, c);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function moneyTotals(records: DashboardRecord[]): MoneyTotal[] {
  const map = new Map<string, MoneyTotal>();
  for (const r of records) {
    if (r.sum == null && r.total == null) continue;
    const key = `${r.type.id}|${r.unit ?? ''}`;
    const m = map.get(key) ?? {
      typeId: r.type.id,
      code: r.type.code,
      color: r.type.color,
      unit: r.unit,
      count: 0,
      sum: 0,
      total: 0,
    };
    m.count += 1;
    m.sum += r.sum ?? 0;
    m.total += r.total ?? 0;
    map.set(key, m);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function geoRoutes(records: DashboardRecord[]): GeoRoute[] {
  const out: GeoRoute[] = [];
  for (const r of records) {
    const fromGeo = parseLatLng(r.fromGeo);
    const toGeo = parseLatLng(r.toGeo);
    if (!fromGeo && !toGeo) continue;
    out.push({
      id: r.id,
      title: r.title,
      from: r.from,
      to: r.to,
      fromGeo,
      toGeo,
      date: eventDate(r),
    });
  }
  return out;
}

/**
 * Fold a user's records into everything a dashboard draws from. Pure: no DB, no
 * clock (pass `now`), so it is unit-testable and deterministic.
 */
export function buildDashboardData(
  user: DashboardUser,
  raw: RawDashboardRecord[],
  now: Date = new Date(),
): DashboardData {
  const records: DashboardRecord[] = [...raw]
    .sort((a, b) => sortKey(b) - sortKey(a) || (a.id < b.id ? 1 : -1))
    .map((r) => {
      const isCreator = r.creator?.id === user.id;
      const isAssignee = r.assignee?.id === user.id;
      const role = isCreator && isAssignee ? 'both' : isAssignee ? 'assignee' : 'creator';
      return { ...r, role };
    });

  const dates = records.map(eventDate).filter((d): d is Date => d !== null);
  const earliest = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  const isFuture = (r: DashboardRecord) => {
    const d = eventDate(r);
    return d !== null && d.getTime() > now.getTime();
  };

  return {
    records,
    created: records.filter((r) => r.role !== 'assignee'),
    assigned: records.filter((r) => r.role !== 'creator'),
    countsByType: countsByType(records),
    range: { earliest, latest },
    byYear: byYear(records),
    correspondents: correspondents(records, user),
    projects: projectCounts(records),
    money: moneyTotals(records),
    recent: records.filter((r) => !isFuture(r)).slice(0, LIST_LIMIT),
    upcoming: records.filter(isFuture).reverse().slice(0, LIST_LIMIT),
    geo: geoRoutes(records),
  };
}
