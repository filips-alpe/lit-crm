import type { Correspondent, DashboardRecord, DashboardUser, YearCount } from './types';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Punctuation is not part of a name word: "Mary (Polly) Stevenson Hewson", "Hewson, Polly",
// "B. Smith". Letters, digits, apostrophes and hyphens are.
const tokens = (s: string) =>
  s
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** A from/to field may name several people: "John Viny; Mary Hewson". */
const parties = (field: string | null) =>
  (field ?? '')
    .split(';')
    .map((s) => s.trim())
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

/** One distinct (from, to) pair of letter parties and the records that carry it. */
export interface PartyPair {
  from: string | null;
  to: string | null;
  count: number;
  /** Earliest/latest `date ?? start` among those records (null when all undated). */
  first: Date | null;
  last: Date | null;
}

/**
 * Fold SQL-grouped (from, to) pairs into the user's correspondents. A field naming several
 * parties ("A; B") counts for each of them. Pairs must
 * arrive newest-first: the first spelling seen of a name is the one displayed.
 */
export function foldCorrespondents(pairs: PartyPair[], user: Pick<DashboardUser, 'name'>) {
  const map = new Map<string, Correspondent>();
  const touch = (name: string, dir: 'sent' | 'received' | null, p: PartyPair) => {
    const key = norm(name);
    let c = map.get(key);
    if (!c) {
      c = { name: name.trim(), sent: 0, received: 0, total: 0, first: null, last: null };
      map.set(key, c);
    }
    c.total += p.count;
    if (dir) c[dir] += p.count;
    if (p.first && (!c.first || p.first < c.first)) c.first = p.first;
    if (p.last && (!c.last || p.last > c.last)) c.last = p.last;
  };
  for (const p of pairs) {
    const from = parties(p.from);
    const to = parties(p.to);
    const fromMe = from.some((n) => isSelf(n, user));
    const toMe = to.some((n) => isSelf(n, user));
    for (const n of to) if (!isSelf(n, user)) touch(n, fromMe ? 'sent' : null, p);
    for (const n of from) if (!isSelf(n, user)) touch(n, toMe ? 'received' : null, p);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Longest span (years) whose gaps are zero-filled; a bad date like 0001 must not yield thousands of bars. */
const MAX_FILLED_SPAN = 500;

/** Sparse per-year counts to an ascending series with gaps filled with 0
 *  (left sparse when the span exceeds `MAX_FILLED_SPAN`). */
export function fillYears(rows: YearCount[]): YearCount[] {
  if (rows.length === 0) return [];
  const span = Math.max(...rows.map((r) => r.year)) - Math.min(...rows.map((r) => r.year));
  if (span > MAX_FILLED_SPAN) return [...rows].sort((a, b) => a.year - b.year);
  const counts = new Map(rows.map((r) => [r.year, r.count]));
  const years = rows.map((r) => r.year);
  const out: YearCount[] = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    out.push({ year: y, count: counts.get(y) ?? 0 });
  }
  return out;
}

/** How the user relates to a record. */
export function roleOf(
  r: { creator: { id: string } | null; assignee: { id: string } | null },
  userId: string,
): DashboardRecord['role'] {
  const isCreator = r.creator?.id === userId;
  const isAssignee = r.assignee?.id === userId;
  return isCreator && isAssignee ? 'both' : isAssignee ? 'assignee' : 'creator';
}
