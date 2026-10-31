import { beforeAll, describe, expect, it } from 'vitest';
import { buildContext, cleanRange, type CleanContext } from './clean';
import { loadSources } from './fetch';
import { mapLines, type LineMap } from './pages';
import {
  buildSplit,
  EXPECTED_QUERIES,
  EXPECTED_SECTIONS,
  fixTitle,
  parseDateStart,
  parseDay,
  parseYear,
  STATIC_ANCHORS,
  titleCase,
  type SplitRecord,
} from './split';

describe('titleCase', () => {
  it('capitalises words but keeps small words and roman numerals', () => {
    expect(titleCase('THE IMPORTANCE OF ADHERING TO RULES.')).toBe(
      'The Importance of Adhering to Rules',
    );
    expect(titleCase('QUORUM')).toBe('Quorum');
    expect(titleCase('SECTION XIV')).toBe('Section XIV');
  });
  it('drops trailing OCR junk but keeps a closing question mark', () => {
    expect(titleCase('RESOLUTIONS. \\')).toBe('Resolutions');
    expect(titleCase('WHAT?')).toBe('What?');
  });
});

describe('fixTitle', () => {
  it('repairs OCR damage in a title only, and says so', () => {
    expect(fixTitle('how jar they are navigable ?')).toEqual({
      title: 'how far they are navigable?',
      fixed: true,
    });
    expect(fixTitle('A notice of its Mountains?')).toEqual({
      title: 'A notice of its Mountains?',
      fixed: false,
    });
  });
});

describe('dates', () => {
  it('reads day and year through OCR digit slips', () => {
    expect(parseDay('11th')).toBe(11);
    expect(parseDay('r1th')).toBe(11);
    expect(parseDay('1rth')).toBe(11);
    expect(parseDay('3d')).toBe(3);
    expect(parseDay('sth')).toBe(5);
  });
  it('refuses readings that are not unambiguous', () => {
    expect(parseDay('oth')).toBeNull();
    expect(parseDay('rsth')).toBeNull();
    expect(parseDay('41st')).toBeNull();
    expect(parseDay('2th')).toBeNull();
  });
  it('limits years to the period of the text', () => {
    expect(parseYear('1792')).toBe(1792);
    expect(parseYear('r792')).toBe(1792);
    expect(parseYear('1492')).toBeNull();
  });
  it('gives an ISO date only when day and year are both stated', () => {
    const full = parseDateStart('March the 11th, 1792. Mr. Sterret tells me');
    expect(full?.iso).toBe('1792-03-11');
    expect(full?.label).toBe('11 March 1792');
    expect(full?.printed).toBe('March the 11th, 1792');

    const noYear = parseDateStart('January the 10th. Doctor Rush tells me');
    expect(noYear?.iso).toBeNull();
    expect(noYear?.label).toBe('10 January');

    const badDay = parseDateStart('April the oth, 1792. The President had wished');
    expect(badDay?.iso).toBeNull();
    expect(badDay?.label).toBe('April 1792');
    expect(badDay?.printed).toBe('April the oth, 1792');
  });
  it('does not take an ordinary sentence for a dateline', () => {
    expect(parseDateStart('March was a hard month for the House.')).toBeNull();
    expect(parseDateStart('May, 1792, was the time when it began')).toBeNull();
    expect(parseDateStart('The 11th of March')).toBeNull();
  });
});

describe('real corpus', () => {
  const src = loadSources();
  const lines = src.djvu.split('\n');
  let map: LineMap;
  let ctx: CleanContext;
  let records: SplitRecord[];
  let counts: Record<string, number>;
  beforeAll(() => {
    map = mapLines(src.djvu, src.searchtext, src.pageindex, src.pageLabels);
    ctx = buildContext(lines, map);
    ({ records, counts } = buildSplit({ lines, map, ctx }));
  });

  it('finds 23 queries and 53 manual sections', () => {
    expect(counts.query).toBe(EXPECTED_QUERIES);
    expect(counts['manual-section']).toBe(EXPECTED_SECTIONS);
    expect(records.filter((r) => r.type === 'query').map((r) => r.title.split(':')[0])).toEqual(
      Array.from(
        { length: 23 },
        (_, k) =>
          `Query ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII'][k]}`,
      ),
    );
    const sections = records.filter((r) => r.type === 'manual-section');
    expect(sections.map((r) => Number(/^Section (\d+):/.exec(r.title)![1]))).toEqual(
      Array.from({ length: 53 }, (_, k) => k + 1),
    );
  });

  it('puts every raw line in exactly one record', () => {
    const owner = new Array<number>(lines.length).fill(0);
    for (const r of records) {
      expect(r.end).toBeGreaterThanOrEqual(r.start);
      for (let l = r.start; l <= r.end; l++) owner[l - 1]++;
    }
    expect(owner.every((n) => n === 1)).toBe(true);
    expect(records[0].start).toBe(1);
    expect(records.at(-1)!.end).toBe(lines.length);
    for (let i = 1; i < records.length; i++) expect(records[i].start).toBe(records[i - 1].end + 1);
  });

  it('has unique keys and non-empty, unique, clean titles', () => {
    expect(new Set(records.map((r) => r.key)).size).toBe(records.length);
    expect(new Set(records.map((r) => r.title)).size).toBe(records.length);
    for (const r of records) {
      expect(r.title.trim()).toBe(r.title);
      expect(r.title).not.toMatch(/\s{2}|\\/);
      expect(r.title.length).toBeGreaterThan(5);
    }
  });

  it('records where each boundary was found, matching the page map', () => {
    for (const r of records) {
      expect(r.boundary.rawLine).toBe(r.start);
      expect(r.boundary.matched).toBe(lines[r.start - 1].trim());
      expect(r.boundary.leaf).toBe(map.lines[r.start - 1].leaf);
      expect(r.boundary.page).toBe(map.lines[r.start - 1].page);
    }
  });

  it('cuts only at the start of a text block', () => {
    for (const r of records.slice(1)) {
      const i = r.start - 1;
      expect(lines[i].trim(), `record ${r.key} starts on a blank line`).not.toBe('');
      expect(ctx.furniture[i], `record ${r.key} starts on furniture`).toBeNull();
      const before = lines[i - 1].trim() === '' || ctx.furniture[i - 1] !== null;
      expect(before, `record ${r.key} starts inside a block`).toBe(true);
    }
  });

  it('never cuts a paragraph that cleanup merged over a page break, or a hyphenated word', () => {
    const whole = cleanRange(ctx, 0, lines.length - 1);
    const merges = new Set(whole.log.filter((l) => l.kind === 'page-merge').map((l) => l.rawLine));
    const hyphens = new Set(
      whole.log.filter((l) => l.kind.startsWith('hyphen')).map((l) => l.rawLine),
    );
    expect(merges.size).toBeGreaterThan(100);
    for (const r of records) {
      expect(merges.has(r.start), `${r.key} starts where pages were merged`).toBe(false);
      // a hyphen decision is logged at the line that ends in the hyphen: it must not be a record's last line
      expect(hyphens.has(r.end), `${r.key} ends on a hyphenated line`).toBe(false);
    }
  });

  it('cleans to the same text whether cut into records or not', () => {
    const whole = cleanRange(ctx, 0, lines.length - 1);
    const parts = records.map((r) => cleanRange(ctx, r.start - 1, r.end - 1));
    const joined = parts
      .map((p) => p.text)
      .filter((t) => t !== '')
      .join('\n\n');
    expect(joined).toBe(whole.text);
    // the logs partition the whole log
    expect(parts.flatMap((p) => p.log).length).toBe(whole.log.length);
    expect(parts.every((p) => p.text.length > 0)).toBe(true);
  });

  it('keeps the three unrelated-word breaks and a split compound each inside one record', () => {
    const whole = cleanRange(ctx, 0, lines.length - 1);
    const unrelated = whole.log.filter((l) => l.reason?.includes('unrelated'));
    expect(unrelated.length).toBe(3);
    for (const e of unrelated) {
      const owners = records.filter((r) => r.start <= e.rawLine + 1 && e.rawLine <= r.end);
      expect(owners.length).toBe(1);
      expect(owners[0].end).toBeGreaterThan(e.rawLine);
    }
  });

  it('opens each static anchor on its verbatim text', () => {
    for (const a of STATIC_ANCHORS) {
      if (a.startsWith === undefined) continue;
      const r = records.find((x) => x.start === a.line);
      expect(r, `anchor ${a.line}`).toBeDefined();
      expect(lines[a.line - 1].trim().startsWith(a.startsWith)).toBe(true);
      if (a.title) expect(r!.title.startsWith(a.title.slice(0, 20))).toBe(true);
    }
  });

  it('assigns parts in order and gives the autobiography dataset titles a note', () => {
    const order = [
      'editorial',
      'autobiography',
      'anas',
      'editorial',
      'notes-on-virginia',
      'parliamentary-manual',
    ];
    const seq = records.map((r) => r.part).filter((p, i, a) => i === 0 || p !== a[i - 1]);
    // the volume I front matter comes first, then the memoir, appendix notes and the Anas
    expect(seq.slice(0, 1)).toEqual(['editorial']);
    expect(seq).toEqual(order);
    const memoir = records.filter((r) => r.part === 'autobiography' && r.type === 'memoir-section');
    const supplied = memoir.filter((r) => r.note?.startsWith('Title supplied by the dataset'));
    expect(supplied.length).toBeGreaterThanOrEqual(20);
    expect(supplied.every((r) => /dataset/.test(r.note ?? ''))).toBe(true);
  });

  it('records an Anas date only where the text states day and year', () => {
    const anas = records.filter((r) => r.part === 'anas' && r.date);
    expect(anas.length).toBeGreaterThan(40);
    for (const r of anas.filter((x) => x.boundary.rule !== 'static-anchor')) {
      const printed = r.description ?? '';
      expect(printed, r.key).toMatch(/[\dIltr][\dIlOot]{3}\b/);
      expect(r.title).toContain(String(new Date(r.date! + 'T00:00:00Z').getUTCDate()));
    }
    // memoranda dated without a year carry no date
    const noYear = records.find((r) => r.title === 'Dinner with President Adams: 1 March');
    expect(noYear).toBeDefined();
    expect(noYear!.date).toBeUndefined();
  });

  it('tags the Logan appendix statements as depositions or letters', () => {
    const logan = records.filter((r) => r.title.startsWith('Logan appendix'));
    expect(logan.length).toBeGreaterThanOrEqual(19);
    expect(logan.filter((r) => r.type === 'deposition').length).toBeGreaterThan(10);
  });
});
