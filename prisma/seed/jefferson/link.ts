/**
 * Deterministic mention linking: case-sensitive, word-boundary, longest match first,
 * non-overlapping. No model and no network. For every mention `text.slice(start, end) === surface`.
 */
import { buildAliasIndex, leadOf, resolveIn, type AliasIndex, type Gazetteer } from './entities';
import type { PartId, RecordTypeCode } from './split';

export type Mention = { start: number; end: number; surface: string; entityKey: string };
export type AmbiguousHit = {
  start: number;
  end: number;
  surface: string;
  candidates: string[];
};
export type LinkResult = { mentions: Mention[]; ambiguous: AmbiguousHit[] };

const isWordChar = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** A hyphen inside a word keeps both halves joined: no mention starts or ends against one. */
const joinedBefore = (text: string, i: number): boolean =>
  isWordChar(text[i - 1]) || (text[i - 1] === '-' && isWordChar(text[i - 2]));
const joinedAfter = (text: string, j: number): boolean =>
  isWordChar(text[j]) || (text[j] === '-' && isWordChar(text[j + 1]));

const indexCache = new WeakMap<Gazetteer, AliasIndex>();
function indexOf(g: Gazetteer | AliasIndex): AliasIndex {
  if ('byLead' in g) return g;
  let ix = indexCache.get(g);
  if (!ix) indexCache.set(g, (ix = buildAliasIndex(g)));
  return ix;
}

type Candidate =
  | { start: number; end: number; kind: 'entity'; entityKey: string }
  | { start: number; end: number; kind: 'ambiguous'; candidates: string[] };

export function linkMentions(
  text: string,
  gazetteer: Gazetteer | AliasIndex,
  part: PartId,
): LinkResult {
  const ix = indexOf(gazetteer);
  const candidates: Candidate[] = [];
  const word = /[\p{L}\p{N}]+/gu;
  for (let m = word.exec(text); m; m = word.exec(text)) {
    const i = m.index;
    if (joinedBefore(text, i)) continue;
    const list = ix.byLead.get(leadOf(m[0]));
    if (!list) continue;
    for (const entry of list) {
      const end = i + entry.surface.length;
      if (!text.startsWith(entry.surface, i)) continue;
      if (isWordChar(entry.surface.at(-1)) && joinedAfter(text, end)) continue;
      const r = resolveIn(entry, part);
      if (!r) continue;
      candidates.push(
        r.kind === 'entity'
          ? { start: i, end, kind: 'entity', entityKey: r.entityKey }
          : { start: i, end, kind: 'ambiguous', candidates: r.candidates },
      );
    }
  }
  // longest first; the earlier of two equally long candidates wins
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const taken: [number, number][] = [];
  const free = (s: number, e: number) => taken.every(([ts, te]) => e <= ts || s >= te);
  const kept: Candidate[] = [];
  for (const c of candidates) {
    if (!free(c.start, c.end)) continue;
    taken.push([c.start, c.end]);
    kept.push(c);
  }
  kept.sort((a, b) => a.start - b.start);
  const out: LinkResult = { mentions: [], ambiguous: [] };
  for (const c of kept) {
    const surface = text.slice(c.start, c.end);
    if (c.kind === 'entity')
      out.mentions.push({ start: c.start, end: c.end, surface, entityKey: c.entityKey });
    else out.ambiguous.push({ start: c.start, end: c.end, surface, candidates: c.candidates });
  }
  return out;
}

/** Record types whose text is never linked (title pages, rosters, scan residue). */
export const UNLINKED_TYPES: ReadonlySet<RecordTypeCode> = new Set<RecordTypeCode>([
  'front-matter',
]);

export function linkRecord(
  record: { type: RecordTypeCode; part: PartId; text: string },
  gazetteer: Gazetteer | AliasIndex,
): LinkResult {
  if (UNLINKED_TYPES.has(record.type)) return { mentions: [], ambiguous: [] };
  return linkMentions(record.text, gazetteer, record.part);
}
