/**
 * Assembles the whole Jefferson dataset from the cached sources: page map, cleanup, record
 * split, gazetteer and mention linking. Pure and deterministic; reads only the committed cache.
 */
import {
  buildContext,
  cleanRange,
  type CleanContext,
  type CleanLogEntry,
  type CleanStats,
} from './clean';
import { nameCandidates } from './candidates';
import { buildAliasIndex, loadGazetteer, type AliasIndex, type Gazetteer } from './entities';
import { loadSources, manifest, type LoadedSources } from './fetch';
import { linkRecord } from './link';
import { mapLines, type LineMap } from './pages';
import { buildSplit, type PartId, type RecordTypeCode, type SplitRecord } from './split';
import type { EntityTypeCode } from './types';

export const IA_REFERENCE = `Internet Archive: ${manifest.detailsUrl}`;
const EDITION = 'Lipscomb & Bergh, The Writings of Thomas Jefferson (1905)';

export type JeffersonRecord = {
  key: string;
  type: RecordTypeCode;
  part: PartId;
  title: string;
  description?: string;
  text: string;
  note?: string;
  references: string[];
  date?: string;
  rawLineStart: number;
  rawLineEnd: number;
  leafStart: number;
  leafEnd: number;
  pageStart: string;
  pageEnd: string;
  volume: 1 | 2;
};

export type JeffersonEntity = {
  key: string;
  type: EntityTypeCode;
  title: string;
  note?: string;
  references: string[];
  mentionCount: number;
};

export type JeffersonMention = {
  recordKey: string;
  entityKey: string;
  start: number;
  end: number;
  surface: string;
};

export type LogRow = CleanLogEntry & { recordKey: string };

export type AmbiguousHitRow = { recordKey: string; surface: string; candidates: string[] };

export type Dataset = {
  records: JeffersonRecord[];
  entities: JeffersonEntity[];
  mentions: JeffersonMention[];
  cleanupLog: LogRow[];
  /** Everything the report needs that is not in the four output files. */
  analysis: {
    lines: string[];
    map: LineMap;
    ctx: CleanContext;
    split: SplitRecord[];
    stats: CleanStats[];
    gazetteer: Gazetteer;
    ambiguousHits: AmbiguousHitRow[];
    unmatched: Map<string, number>;
    unmatchedByPart: Map<PartId, number>;
    linkedByPart: Map<PartId, number>;
    ambiguousByPart: Map<PartId, number>;
  };
};

export const ENTITY_KEY_PREFIX = 'jefferson-ent-';

const ROMAN = ['', 'I', 'II'];

const nonWs = (s: string): number => s.replace(/\s+/g, '').length;

/** Pages printed within raw lines [start, end] (1-based): first and last non-empty label. */
function pageRange(map: LineMap, start: number, end: number): [string, string] {
  let first = '';
  let last = '';
  for (let i = start - 1; i <= end - 1; i++) {
    const p = map.lines[i].page;
    if (p === '') continue;
    if (first === '') first = p;
    last = p;
  }
  return [first, last];
}

/** `Lipscomb & Bergh, ..., vol. I, pp. 1-14 (leaves 39-52; djvu_txt lines 1007-1473)` */
export function locationString(
  vol: 1 | 2,
  pages: [string, string],
  leaves: [number, number],
  lines: [number, number],
): string {
  const [p0, p1] = pages;
  const where = p0 === '' ? 'unnumbered pages' : p0 === p1 ? `p. ${p0}` : `pp. ${p0}-${p1}`;
  const leaf = leaves[0] === leaves[1] ? `leaf ${leaves[0]}` : `leaves ${leaves[0]}-${leaves[1]}`;
  const at = lines[0] === lines[1] ? `line ${lines[0]}` : `lines ${lines[0]}-${lines[1]}`;
  return `${EDITION}, vol. ${ROMAN[vol]}, ${where} (${leaf}; djvu_txt ${at})`;
}

/**
 * The raw line (1-based) holding the character at `offset` of a record's cleaned text.
 * Cleaned text and raw lines carry the same non-whitespace characters except for logged
 * furniture and hyphens joined away, so counting those gives the line exactly.
 */
export function rawLineAt(
  ctx: CleanContext,
  start: number,
  end: number,
  joinedHyphenLines: Set<number>,
  text: string,
  offset: number,
): number {
  const target = nonWs(text.slice(0, offset));
  let seen = 0;
  for (let i = start - 1; i <= end - 1; i++) {
    if (ctx.furniture[i]) continue;
    let n = nonWs(ctx.lines[i]);
    if (joinedHyphenLines.has(i + 1)) n -= 1;
    if (target < seen + n) return i + 1;
    seen += n;
  }
  return end;
}

export function buildDataset(
  sources: LoadedSources = loadSources(),
  gazetteer: Gazetteer = loadGazetteer(),
): Dataset {
  const lines = sources.djvu.split('\n');
  const map = mapLines(sources.djvu, sources.searchtext, sources.pageindex, sources.pageLabels);
  const ctx = buildContext(lines, map);
  const { records: split } = buildSplit({ lines, map, ctx });
  const index: AliasIndex = buildAliasIndex(gazetteer);

  const records: JeffersonRecord[] = [];
  const cleanupLog: LogRow[] = [];
  const stats: CleanStats[] = [];
  const mentions: JeffersonMention[] = [];
  const ambiguousHits: AmbiguousHitRow[] = [];
  const unmatched = new Map<string, number>();
  const unmatchedByPart = new Map<PartId, number>();
  const linkedByPart = new Map<PartId, number>();
  const ambiguousByPart = new Map<PartId, number>();
  const bump = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

  type First = { recordKey: string; line: number };
  const firstMention = new Map<string, First>();
  const mentionCount = new Map<string, number>();
  const recordLocation = new Map<string, string>();

  for (const s of split) {
    const cleaned = cleanRange(ctx, s.start - 1, s.end - 1);
    stats.push(cleaned.stats);
    for (const e of cleaned.log) cleanupLog.push({ recordKey: s.key, ...e });
    const volume = map.lines[s.start - 1].volume;
    const leaves: [number, number] = [map.lines[s.start - 1].leaf, map.lines[s.end - 1].leaf];
    const pages = pageRange(map, s.start, s.end);
    const location = locationString(volume, pages, leaves, [s.start, s.end]);
    recordLocation.set(s.key, location);
    records.push({
      key: s.key,
      type: s.type,
      part: s.part,
      title: s.title,
      ...(s.description !== undefined ? { description: s.description } : {}),
      text: cleaned.text,
      ...(s.note !== undefined ? { note: s.note } : {}),
      references: [IA_REFERENCE, location],
      ...(s.date !== undefined ? { date: s.date } : {}),
      rawLineStart: s.start,
      rawLineEnd: s.end,
      leafStart: leaves[0],
      leafEnd: leaves[1],
      pageStart: pages[0],
      pageEnd: pages[1],
      volume,
    });

    const joined = new Set(
      cleaned.log.filter((l) => l.kind === 'hyphen-join').map((l) => l.rawLine),
    );
    const res = linkRecord({ type: s.type, part: s.part, text: cleaned.text }, index);
    for (const m of res.mentions) {
      const entityKey = ENTITY_KEY_PREFIX + m.entityKey;
      mentions.push({
        recordKey: s.key,
        entityKey,
        start: m.start,
        end: m.end,
        surface: m.surface,
      });
      bump(mentionCount, entityKey);
      bump(linkedByPart, s.part);
      if (!firstMention.has(entityKey)) {
        firstMention.set(entityKey, {
          recordKey: s.key,
          line: rawLineAt(ctx, s.start, s.end, joined, cleaned.text, m.start),
        });
      }
    }
    for (const a of res.ambiguous) {
      bump(ambiguousByPart, s.part);
      ambiguousHits.push({ recordKey: s.key, surface: a.surface, candidates: a.candidates });
    }
    if (s.type !== 'front-matter') {
      const spans = [...res.mentions, ...res.ambiguous];
      for (const c of nameCandidates(cleaned.text)) {
        if (spans.some((x) => c.start < x.end && x.start < c.end)) continue;
        bump(unmatched, c.surface);
        bump(unmatchedByPart, s.part);
      }
    }
  }

  const entities: JeffersonEntity[] = [];
  for (const e of gazetteer.entities) {
    const key = ENTITY_KEY_PREFIX + e.key;
    const first = firstMention.get(key);
    if (!first) continue;
    const rec = split.find((r) => r.key === first.recordKey)!;
    const pos = map.lines[first.line - 1];
    const loc = locationString(
      pos.volume,
      pageRange(map, first.line, first.line),
      [pos.leaf, pos.leaf],
      [first.line, first.line],
    );
    entities.push({
      key,
      type: e.type,
      title: e.name,
      ...(e.note !== undefined ? { note: e.note } : {}),
      references: [IA_REFERENCE, `${loc}; first mention in "${rec.title}"`],
      mentionCount: mentionCount.get(key)!,
    });
  }

  return {
    records,
    entities,
    mentions,
    cleanupLog,
    analysis: {
      lines,
      map,
      ctx,
      split,
      stats,
      gazetteer,
      ambiguousHits,
      unmatched,
      unmatchedByPart,
      linkedByPart,
      ambiguousByPart,
    },
  };
}
