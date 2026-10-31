import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildDataset, IA_REFERENCE, rawLineAt, locationString, type Dataset } from './dataset';
import { OUTPUT_DIR, renderOutputs } from './generate';
import { jeffersonTypes } from './types';

const strip = (s: string) => s.replace(/\s+/g, '');
const FURNITURE = new Set(['running-head', 'page-number', 'signature-mark', 'library-stamp']);

describe('the Jefferson dataset (real cache)', () => {
  let d: Dataset;
  const fetchSpy = vi.fn(() => {
    throw new Error('network use is not allowed when generating');
  });
  beforeAll(() => {
    vi.stubGlobal('fetch', fetchSpy);
    d = buildDataset();
  });

  it('uses no network', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('puts every raw line in exactly one record', () => {
    const owner = new Array<number>(d.analysis.lines.length).fill(0);
    for (const r of d.records) {
      for (let l = r.rawLineStart; l <= r.rawLineEnd; l++) owner[l - 1]++;
    }
    expect(owner.every((n) => n === 1)).toBe(true);
    expect(d.records[0].rawLineStart).toBe(1);
    expect(d.records.at(-1)!.rawLineEnd).toBe(d.analysis.lines.length);
  });

  it('keeps each record verbatim: its text is its raw lines minus logged furniture and logged hyphens', () => {
    const { lines } = d.analysis;
    const furniture = new Set<number>();
    const joined = new Set<number>();
    for (const e of d.cleanupLog) {
      if (FURNITURE.has(e.kind)) furniture.add(e.rawLine);
      if (e.kind === 'hyphen-join') joined.add(e.rawLine);
    }
    expect(furniture.size).toBeGreaterThan(1000);
    expect(joined.size).toBeGreaterThan(500);
    for (const r of d.records) {
      let expected = '';
      for (let l = r.rawLineStart; l <= r.rawLineEnd; l++) {
        if (furniture.has(l)) continue;
        let t = lines[l - 1].trim();
        if (joined.has(l)) {
          expect(t.endsWith('-'), `${r.key} line ${l}`).toBe(true);
          t = t.slice(0, -1);
        }
        expected += t;
      }
      expect(strip(r.text), r.key).toBe(strip(expected));
    }
  });

  it('logs every change under the record that owns its raw line', () => {
    const byKey = new Map(d.records.map((r) => [r.key, r]));
    for (const e of d.cleanupLog) {
      const r = byKey.get(e.recordKey)!;
      expect(e.rawLine).toBeGreaterThanOrEqual(r.rawLineStart);
      expect(e.rawLine).toBeLessThanOrEqual(r.rawLineEnd);
    }
  });

  it('has every mention slice equal to its surface, inside known records and entities', () => {
    const rec = new Map(d.records.map((r) => [r.key, r]));
    const ent = new Map(d.entities.map((e) => [e.key, e]));
    const per = new Map<string, number>();
    let last = { recordKey: '', end: 0 };
    for (const m of d.mentions) {
      const r = rec.get(m.recordKey)!;
      expect(r, m.recordKey).toBeDefined();
      expect(ent.has(m.entityKey), m.entityKey).toBe(true);
      expect(r.text.slice(m.start, m.end)).toBe(m.surface);
      expect(r.type).not.toBe('front-matter');
      if (last.recordKey === m.recordKey) expect(m.start).toBeGreaterThanOrEqual(last.end);
      last = { recordKey: m.recordKey, end: m.end };
      per.set(m.entityKey, (per.get(m.entityKey) ?? 0) + 1);
    }
    for (const e of d.entities) expect(e.mentionCount).toBe(per.get(e.key));
    expect(d.entities.every((e) => e.mentionCount >= 1)).toBe(true);
  });

  it('gives every record and entity the Internet Archive item and a location', () => {
    const loc =
      /^Lipscomb & Bergh, The Writings of Thomas Jefferson \(1905\), vol\. (I|II), (pp?\. [^ ]+|unnumbered pages) \((?:leaf|leaves) [\d-]+; djvu_txt lines? [\d-]+\)/;
    for (const x of [...d.records, ...d.entities]) {
      expect(x.references[0]).toBe(IA_REFERENCE);
      expect(x.references[1], x.key).toMatch(loc);
      expect(x.references).toHaveLength(2);
    }
    expect(IA_REFERENCE).toBe(
      'Internet Archive: https://archive.org/details/writingsofthomas0000vari_v5r4',
    );
  });

  it('matches the documented reference example for the Autobiography', () => {
    const r = d.records.find((x) => x.title === 'Autobiography: family, birth and education')!;
    expect(r.references[1]).toMatch(/vol\. I, pp\. 2-4 \(leaves 39-42; djvu_txt lines 1007-1123\)/);
  });

  it('puts an entity first mention on the raw line where the surface starts', () => {
    const { lines } = d.analysis;
    const firstOf = new Map<string, (typeof d.mentions)[number]>();
    for (const m of d.mentions) if (!firstOf.has(m.entityKey)) firstOf.set(m.entityKey, m);
    let checked = 0;
    for (const e of d.entities) {
      const m = firstOf.get(e.key)!;
      const line = Number(/djvu_txt line (\d+)\)/.exec(e.references[1])![1]);
      const two = `${lines[line - 1]} ${lines[line] ?? ''}`;
      const head = m.surface.replace(/[^\p{L}]/gu, '').slice(0, 3);
      const near = two.replace(/[^\p{L}]/gu, '');
      expect(near.includes(head), `${e.key}: ${m.surface} at line ${line}`).toBe(true);
      checked++;
    }
    expect(checked).toBe(d.entities.length);
  });

  it('uses only declared types', () => {
    const codes = new Set(jeffersonTypes.map((t) => t.code));
    for (const r of d.records) expect(codes.has(r.type), r.type).toBe(true);
    for (const e of d.entities) expect(codes.has(e.type), e.type).toBe(true);
  });

  it('is several hundred entities with mentions in every entity type that has one', () => {
    expect(d.entities.length).toBeGreaterThanOrEqual(400);
    expect(d.records).toHaveLength(295);
    expect(d.records.filter((r) => r.type === 'query')).toHaveLength(23);
    expect(d.records.filter((r) => r.type === 'manual-section')).toHaveLength(53);
  });

  it('regenerates byte-identically, and the committed outputs are current', () => {
    const again = renderOutputs(buildDataset());
    const first = renderOutputs(d);
    expect(again).toEqual(first);
    for (const [path, content] of first) {
      expect(readFileSync(path, 'utf8'), path).toBe(content);
    }
    expect(first.map(([p]) => p).filter((p) => p.startsWith(OUTPUT_DIR))).toHaveLength(4);
  });
});

describe('REPORT.md', () => {
  const d = buildDataset();
  const report = renderOutputs(d).find(([p]) => p.endsWith('REPORT.md'))![1];

  it('states counts, link rate, OCR issues and unlinked surfaces from the data', () => {
    expect(report).toContain(`Records: **${d.records.length}**`);
    expect(report).toContain(`Entities with at least one mention: **${d.entities.length}**`);
    expect(report).toMatch(/\*\*link rate\*\* \| \*\*\d+\.\d%\*\*/);
    for (const h of [
      '## Link rate',
      '## Ambiguous mentions left unlinked',
      '## Top unlinked surfaces',
      '## Cleanup and OCR issues',
      '### Garbled lines',
      '## Hyphen audit',
    ]) {
      expect(report).toContain(h);
    }
  });

  it('audits the hyphens: counts by reason, the unrelated-word breaks, every default join', () => {
    const hy = d.cleanupLog.filter((l) => l.kind.startsWith('hyphen'));
    const unrelated = hy.filter((l) => l.reason === 'unrelated-words');
    expect(unrelated.map((l) => l.raw).sort()).toEqual([
      'eccle-\nV',
      'foh-\nae',
      'paral-\ncivilized',
    ]);
    for (const l of unrelated)
      expect(report).toContain(`| ${l.rawLine} | \`${l.raw.replace('\n', '⏎')}\``);
    const defaults = hy.filter((l) => l.reason === 'default-join');
    expect(defaults.length).toBeGreaterThan(200);
    for (const l of defaults)
      expect(report).toContain(`| ${l.rawLine} | \`${l.raw.replace('\n', '⏎')}\``);
    expect(report).toContain(`${defaults.length} breaks had neither form attested`);
    expect(report).toContain('hyphen-join / default-join');
  });

  it('lists the ambiguous surfaces with their counts', () => {
    for (const s of ['Washington', 'Adams', 'Clinton', 'Ohio']) {
      expect(report).toMatch(new RegExp(`\\| ${s} \\| \\d+ \\|`));
    }
  });
});

describe('locationString and rawLineAt', () => {
  it('formats single and ranged pages and leaves', () => {
    expect(locationString(1, ['14', '14'], [52, 52], [1473, 1473])).toBe(
      'Lipscomb & Bergh, The Writings of Thomas Jefferson (1905), vol. I, p. 14 (leaf 52; djvu_txt line 1473)',
    );
    expect(locationString(2, ['', ''], [616, 620], [21718, 21800])).toContain(
      'vol. II, unnumbered pages (leaves 616-620; djvu_txt lines 21718-21800)',
    );
  });

  it('counts through removed furniture and joined hyphens', () => {
    const lines = ['alpha beta', 'Jefferson’s Works', 'gam-', 'ma delta'];
    const ctx = {
      lines,
      furniture: [null, 'running-head', null, null],
      vocab: new Map(),
      inColumnLeaf: () => false,
    } as never;
    const text = 'alpha beta gamma delta';
    expect(rawLineAt(ctx, 1, 4, new Set([3]), text, 0)).toBe(1);
    expect(rawLineAt(ctx, 1, 4, new Set([3]), text, text.indexOf('gamma'))).toBe(3);
    expect(rawLineAt(ctx, 1, 4, new Set([3]), text, text.indexOf('delta'))).toBe(4);
  });
});
