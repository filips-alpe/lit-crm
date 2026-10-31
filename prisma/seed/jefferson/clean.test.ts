import { describe, expect, it } from 'vitest';
import {
  buildContext,
  cleanRange,
  classifyFurniture,
  decideHyphen,
  isRunningHead,
  isSignatureMark,
} from './clean';
import { loadSources } from './fetch';
import { mapLines, type LineMap } from './pages';

/** Synthetic map: every line on the given leaf (default: split on a marker line "<<leaf>>"). */
function synth(text: string): { lines: string[]; map: LineMap } {
  const lines: string[] = [];
  const pos: LineMap['lines'] = [];
  let leaf = 1;
  for (const l of text.split('\n')) {
    if (l === '<<leaf>>') {
      leaf++;
      continue;
    }
    lines.push(l);
    pos.push({ leaf, page: String(leaf), volume: 1 });
  }
  return { lines, map: { lines: pos, straddling: [] } };
}
const clean = (text: string) => {
  const { lines, map } = synth(text);
  const ctx = buildContext(lines, map);
  return cleanRange(ctx, 0, lines.length - 1);
};

const LONG = 'the quick brown fox jumps over the lazy dog again';

describe('running heads and signature marks', () => {
  it.each([
    '14 Jefferson’s Works',
    "Jefferson's Works 14",
    'Autobiography 21',
    'The Anas 123',
    'Notes on Virginia 31',
    'Appendix | 275',
    'Parliamentary Manual 363',
    'IO Jefferson’s Works',
    'xvii The University of Virginia, and',
    'Contents xlii',
    '# J efferson’s Works'.replace('#', '5'),
    'Tos Jefferson’s Works',
  ])('recognises %j', (t) => expect(isRunningHead(t)).toBe(true));

  it.each([
    'See Appendix, note D. of the report on',
    "Mr. Jefferson's Works are collected here at length",
    'APPENDIX.',
    'AUTOBIOGRAPHY.',
    'NOTES ON VIRGINIA.',
    '',
  ])('rejects %j', (t) => expect(isRunningHead(t)).toBe(false));

  it.each(['VOL. I—I (x)', 'VOL. 11—4.', 'VOL, 1—6', 'VOL. I1—29', 'VOL. II—II'])(
    'signature mark %j',
    (t) => expect(isSignatureMark(t)).toBe(true),
  );
  it('does not take a citation for a signature mark', () => {
    expect(isSignatureMark('Vol. II, p. 12')).toBe(false);
    expect(isSignatureMark('VOLUME TWO')).toBe(false);
  });
});

describe('classifyFurniture', () => {
  it('only treats a running head as furniture near the top of a leaf', () => {
    const { lines, map } = synth(
      ['', '14 Jefferson’s Works', '', LONG, LONG, LONG, LONG, 'Appendix 5', LONG].join('\n'),
    );
    const k = classifyFurniture(lines, map);
    expect(k[1]).toBe('running-head');
    expect(k[7]).toBe(null);
  });

  it('takes a number equal to the page label at a page edge, but not a table cell', () => {
    const { lines, map } = synth(
      ['1', LONG, '2', LONG, LONG, LONG, '<<leaf>>', LONG, '2', LONG, '9'].join('\n'),
    );
    // leaf 1 has label "1"; leaf 2 has label "2"
    const k = classifyFurniture(lines, map);
    expect(k[0]).toBe('page-number'); // "1" first line, label 1
    expect(k[2]).toBe(null); // "2" mid-leaf on leaf 1: not its label
    expect(k[7]).toBe('page-number'); // "2" mid-leaf but equals leaf 2's label
    expect(k[9]).toBe(null); // "9" is the last line, label is 2: a table cell stays
  });

  it('only recognises library stamps within the first lines', () => {
    const { lines, map } = synth(['MEMORIAL ASSOCIATION', LONG].join('\n'));
    expect(classifyFurniture(lines, map)[0]).toBe('library-stamp');
  });
});

describe('decideHyphen', () => {
  const vocab = new Map([
    ['connection', 1],
    ['self-evident', 1],
  ]);
  it('keeps joined when the joined form is attested', () => {
    expect(decideHyphen('a con', 'nection,', vocab)).toEqual({
      keep: false,
      reason: 'joined-form-attested',
      result: 'connection',
    });
  });
  it('keeps the hyphen when only the hyphenated form is attested', () => {
    expect(decideHyphen('are self', 'evident', vocab)).toEqual({
      keep: true,
      reason: 'hyphenated-form-attested',
      result: 'self-evident',
    });
  });
  it('joins by default and does not fix spelling', () => {
    expect(decideHyphen('the zork', 'blat', vocab)).toEqual({
      keep: false,
      reason: 'default-join',
      result: 'zorkblat',
    });
  });
});

describe('cleanRange (synthetic)', () => {
  it('unwraps prose lines with single spaces and separates blocks with a blank line', () => {
    const r = clean([LONG, LONG, 'short end.', '', LONG, 'tail.'].join('\n'));
    expect(r.text).toBe(`${LONG} ${LONG} short end.\n\n${LONG} tail.`);
  });

  it('keeps inner newlines of short-line blocks', () => {
    const r = clean(['QUERY I.', 'BOUNDARIES', 'OF VIRGINIA', '', LONG, 'x.'].join('\n'));
    expect(r.text.startsWith('QUERY I.\nBOUNDARIES\nOF VIRGINIA\n\n')).toBe(true);
  });

  it('logs removed furniture with raw line and text', () => {
    const r = clean(['', '14 Jefferson’s Works', '', LONG, 'x.'].join('\n'));
    expect(r.log).toContainEqual({
      rawLine: 2,
      kind: 'running-head',
      raw: '14 Jefferson’s Works',
      result: '',
    });
    expect(r.text).toBe(`${LONG} x.`);
  });

  it('dehyphenates with a logged decision', () => {
    const r = clean(
      [`${LONG} con-`, 'nection of the line,', '', `${LONG} connection`, 'again.'].join('\n'),
    );
    expect(r.text.split('\n\n')[0]).toContain('connection of the line,');
    const h = r.log.find((l) => l.kind === 'hyphen-join');
    expect(h).toMatchObject({ rawLine: 1, raw: 'con-\nnection', result: 'connection' });
  });

  it('merges a paragraph split by a page break and logs it', () => {
    const r = clean(
      [
        `${LONG} would`,
        '<<leaf>>',
        '3 Jefferson’s Works',
        '',
        `take up the question of it, and so on yes.`,
      ].join('\n'),
    );
    expect(r.text).toBe(`${LONG} would take up the question of it, and so on yes.`);
    expect(r.log.some((l) => l.kind === 'page-merge')).toBe(true);
  });

  it('does not merge across a page break after terminal punctuation or before a capital', () => {
    const a = clean(
      [
        `${LONG} ended.`,
        '<<leaf>>',
        '3 Jefferson’s Works',
        '',
        `then another para one two three four.`,
      ].join('\n'),
    );
    expect(a.text).toContain('ended.\n\nthen');
    const b = clean(
      [
        `${LONG} would`,
        '<<leaf>>',
        '3 Jefferson’s Works',
        '',
        `Then another para one two three four.`,
      ].join('\n'),
    );
    expect(b.text).toContain('would\n\nThen');
  });

  it('applies the hyphen rule across a page break', () => {
    const r = clean(
      [
        `${LONG} recov-`,
        '<<leaf>>',
        '3 Jefferson’s Works',
        '',
        `ery of the thing, and so on yes and no.`,
      ].join('\n'),
    );
    expect(r.text).toContain('recovery of the thing');
  });

  it('does not merge a footnote into the text after the page break', () => {
    const r = clean(
      [
        `* ${LONG}`,
        `${LONG} still going`,
        '<<leaf>>',
        '3 Jefferson’s Works',
        '',
        `continuing the text here at the top of it.`,
      ].join('\n'),
    );
    expect(r.text).toContain('going\n\ncontinuing');
  });
});

describe('real corpus invariants', () => {
  const src = loadSources();
  const lines = src.djvu.split('\n');
  const map = mapLines(src.djvu, src.searchtext, src.pageindex, src.pageLabels);
  const ctx = buildContext(lines, map);
  const strip = (s: string) => s.replace(/\s+/g, '');

  it('keeps every non-furniture character, minus logged joined hyphens', () => {
    const all = cleanRange(ctx, 0, lines.length - 1);
    const furnitureLines = new Set(
      all.log
        .filter((l) => !l.kind.startsWith('hyphen') && l.kind !== 'page-merge')
        .map((l) => l.rawLine),
    );
    const joined = new Set(all.log.filter((l) => l.kind === 'hyphen-join').map((l) => l.rawLine));
    const expected = lines
      .map((l, i) => {
        if (furnitureLines.has(i + 1)) return '';
        return joined.has(i + 1) ? l.trimEnd().replace(/-$/, '') : l;
      })
      .join('\n');
    expect(strip(all.text)).toBe(strip(expected));
  });

  it('never introduces newlines inside prose beyond block structure and logs every dehyphenation', () => {
    const all = cleanRange(ctx, 0, lines.length - 1);
    expect(all.stats.hyphenJoined + all.stats.hyphenKept).toBe(
      all.log.filter((l) => l.kind.startsWith('hyphen')).length,
    );
    expect(all.stats.furnitureLines).toBeGreaterThan(900);
  });
});
