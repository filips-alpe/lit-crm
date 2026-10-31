/**
 * Mechanical cleanup of the raw djvu lines. Nothing here ever corrects OCR
 * typos, letterspacing or spelling. The only permitted changes are:
 *   1. removal of page furniture (running heads, page numbers, signature
 *      marks, library stamps), each logged;
 *   2. line-end dehyphenation, each decision logged;
 *   3. whitespace: lines of a prose block are joined with single spaces and
 *      blocks are separated by a blank line.
 * `cleanRange` is the only entry point that builds record text.
 */
import type { LineMap } from './pages';

export type FurnitureKind = 'running-head' | 'page-number' | 'signature-mark' | 'library-stamp';

export type CleanLogEntry = {
  /** 1-based raw line number in the djvu text file */
  rawLine: number;
  kind: FurnitureKind | 'hyphen-join' | 'hyphen-keep' | 'page-merge';
  raw: string;
  result: string;
  reason?: string;
};

// ---------------------------------------------------------------- furniture

/** Running-head title words. Case-sensitive on purpose: the upper-case forms are real headings. */
export const RUNNING_TITLES: RegExp[] = [
  /[Jl]\s?[eé]ff?\s?[eé]rs[o0][rn]['’‘`"]{0,2}s?['’‘`"]{0,2}\s+['‘]?W[o0]rks/,
  /The\s*\|?\s*Anas/,
  /Notes\s+[eo]n\s+Virginia/,
  /^irginia$/,
  /^Notes on V$/,
  /Appendix/,
  /Autobiography/,
  /Parliamentary Manual/,
  /Special Introduction/,
  /Lincoln['’]s Tribute to Jefferson/,
  /Contents/,
  /Illustrations/,
  /^Introductory Notes$/,
  /The University of Virginia(?:, and)?/,
  /Thomas Jefferson[,;] its[:;]? Father/,
];

/** Library stamp lines on the scanned cover (only recognised before the title page). */
export const LIBRARY_STAMPS: RegExp[] = [
  /^MEMORIAL ASSOCIATION$/,
  /^ROBERT R\. MUNTZ LIBRARY$/,
  /^THE UNIVERSITY OF TEXAS AT TYLER$/,
  /^TYLER, TEXAS \d+$/,
  /^Digitized by the Internet Archive$/,
  /^in 2026$/,
  /^https:\/\/archive\.org\/details\/\S+$/,
];
export const LIBRARY_STAMP_LAST_LINE = 54;

/** `VOL. I—23`, with the OCR damage seen in the volume: `VOL, I.—~9 : 1`, `VOL 1,—10`, `VOL. I1— 26 1`, `YOL. II—I?`. */
const SIGNATURE_MARK =
  /^[VY][O0][LR][.,]?\s*[IVXLl1jt/]{1,4}[.,]?\s*[—–~-]+[—–~\s-]*\S{1,4}(?:\s*\(\S{1,3}\))?(?:\s*[:—–-]*\s*\S{0,2})?\s*[.:—–-]*$/;
/** Dash-less remnant (`VOL II`, `VOL. jt)`): only a signature mark on a numbered page; on title pages it is real wording. */
const BARE_VOLUME_MARK = /^[VY][O0][LR][.,]?\s*\S{1,3}\s*$/;
const PAREN_FOLIO = /^\((?:\d{1,4}|[ivxlcIVXLC]{1,6})\)\s*[:.]?$/;
const ROMAN_FOLIO = /^[ivxlc]{1,6}$/;
const DIGITS = /^\d{1,4}$/;

export function isRunningHead(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 48) return false;
  for (const re of RUNNING_TITLES) {
    const m = re.exec(t);
    if (!m) continue;
    const rest = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length);
    // page numbers in the head may be Roman: they do not count as junk
    const restTrim = rest
      .replace(/\b[ivxlc]+\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (restTrim.length > 10) continue;
    if (/[a-z]{4,}/.test(restTrim)) continue;
    return true;
  }
  return false;
}

/** Unmistakable heads count as furniture anywhere on the leaf (the OCR may order them mid-leaf). */
const WORKS_HEAD = new RegExp(
  `^(?:[\\dIOlTos|]{1,4}\\s+)?${RUNNING_TITLES[0].source}(?:\\s+[\\dIOl|]{1,4})?$`,
);
const SECTION_HEAD =
  /^(?:The Anas|Notes on Virginia|Appendix|Autobiography|Parliamentary Manual)\s+(\d{1,4})$/;

/** `Appendix 5` could be a wrapped citation, so a section head must carry its own page number. */
export function isWholeLineHead(text: string, pageLabel: string): boolean {
  const t = text.trim();
  return WORKS_HEAD.test(t) || SECTION_HEAD.exec(t)?.[1] === pageLabel;
}

export function isSignatureMark(text: string): boolean {
  return SIGNATURE_MARK.test(text.trim());
}

export type FurnitureClass = (FurnitureKind | null)[];

/**
 * Classify every raw line. Loosely matched running heads must sit among the
 * first three non-blank lines of their leaf; unmistakable whole-line heads and
 * signature marks may sit anywhere; page numbers must be the first or last
 * non-blank line. A bare `VOL II` counts only on a numbered page.
 */
export function classifyFurniture(lines: string[], map: LineMap): FurnitureClass {
  const kinds: FurnitureClass = lines.map(() => null);
  const byLeaf = new Map<number, number[]>();
  lines.forEach((l, i) => {
    if (l.trim() === '') return;
    const leaf = map.lines[i].leaf;
    const arr = byLeaf.get(leaf);
    if (arr) arr.push(i);
    else byLeaf.set(leaf, [i]);
  });
  lines.forEach((l, i) => {
    if (i < LIBRARY_STAMP_LAST_LINE && LIBRARY_STAMPS.some((re) => re.test(l.trim()))) {
      kinds[i] = 'library-stamp';
    }
  });
  for (const [leaf, idx] of byLeaf) {
    const label = map.lines[idx[0]].page;
    idx.forEach((i, pos) => {
      if (kinds[i]) return;
      const t = lines[i].trim();
      if (isSignatureMark(t) || (label !== '' && BARE_VOLUME_MARK.test(t))) {
        kinds[i] = 'signature-mark';
        return;
      }
      const edge = pos === 0 || pos === idx.length - 1;
      if ((pos < 3 && isRunningHead(t)) || isWholeLineHead(t, label)) {
        kinds[i] = 'running-head';
        return;
      }
      if (!edge) {
        // a bare number equal to the printed page label is a page number wherever it sits
        if (label !== '' && DIGITS.test(t) && t === label) kinds[i] = 'page-number';
        return;
      }
      if (PAREN_FOLIO.test(t)) kinds[i] = 'page-number';
      else if (label !== '' && DIGITS.test(t) && (t === label || pos === 0))
        kinds[i] = 'page-number';
      else if (label === '' && ROMAN_FOLIO.test(t) && leaf < 60) kinds[i] = 'page-number';
    });
  }
  return kinds;
}

// -------------------------------------------------------------- hyphenation

const PART = "\\p{L}[\\p{L}'’]*";
const WORD = new RegExp(`${PART}(?:-${PART})*`, 'gu');
const WORD_END = new RegExp(`${PART}(?:-${PART})*$`, 'u');
const WORD_START = new RegExp(`^${PART}(?:-${PART})*`, 'u');

/**
 * Lower-cased word forms attested inside single lines, with counts. The word
 * before a line-end hyphen and the word that continues it are fragments
 * (`dis`, `tinued`), never evidence that a word exists, so both are left out.
 */
export function buildVocabulary(
  lines: string[],
  skip: (i: number) => boolean,
): Map<string, number> {
  const vocab = new Map<string, number>();
  let prevHyphenated = false;
  lines.forEach((l, i) => {
    if (skip(i)) return;
    const t = l.trim();
    if (t === '') return;
    const hyphenated = /\p{L}-$/u.test(t);
    const words = [...t.matchAll(WORD)].map((m) => m[0].toLowerCase());
    if (hyphenated) words.pop();
    if (prevHyphenated) words.shift();
    for (const w of words) vocab.set(w, (vocab.get(w) ?? 0) + 1);
    prevHyphenated = hyphenated;
  });
  return vocab;
}

export type HyphenDecision = { keep: boolean; reason: string; result: string };

const NUMBER_WORD =
  /^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/;
const NUMBER_PART =
  /^(?:one|two|three|four|five|six|seven|eight|nine|half|halves|third|thirds|fourth|fourths|fifth|fifths|sixth|sixths|seventh|sevenths|eighth|eighths|ninth|ninths|tenth|tenths|hundredth|hundredths|thousandth|thousandths|\w+tieth|\w+tieths|\w+teenth|\w+teenths)$/;
/** Left parts that are whole words in period compounds, not line-break fragments. */
export const COMPOUND_LEFT = new Set('self ill well double mid half'.split(' '));

/** `left` ends in a letter before the hyphen, `right` starts with the continuation (word part only). */
export function decideHyphen(
  left: string,
  right: string,
  vocab: Map<string, number>,
): HyphenDecision {
  const l = WORD_END.exec(left)?.[0] ?? '';
  const r = WORD_START.exec(right)?.[0] ?? '';
  const ll = l.toLowerCase();
  const rl = r.toLowerCase();
  const joinedCount = vocab.get(ll + rl) ?? 0;
  const hyphCount = vocab.get(`${ll}-${rl}`) ?? 0;
  const keep = (reason: string) => ({ keep: true, reason, result: `${l}-${r}` });
  const join = (reason: string) => ({ keep: false, reason, result: l + r });
  if (joinedCount > 0 && hyphCount > 0)
    return hyphCount > joinedCount
      ? keep('hyphenated-form-more-frequent')
      : join('joined-form-at-least-as-frequent');
  if (joinedCount > 0) return join('joined-form-attested');
  if (hyphCount > 0) return keep('hyphenated-form-attested');
  const override = HYPHEN_OVERRIDES.get(`${ll}-${rl}`);
  if (override) return override === 'keep' ? keep('reviewed-override') : join('reviewed-override');
  if (NUMBER_WORD.test(ll) && NUMBER_PART.test(rl)) return keep('number-compound');
  if (COMPOUND_LEFT.has(ll)) return keep('compound-left-part');
  return join('default-join');
}

/**
 * Compounds with neither form attested, reviewed by hand against the corpus.
 * Both parts being words does not make a compound (`dis-tribute`, `con-text`,
 * `apart-ment`, `weep-ing` all qualify), so these are listed rather than inferred.
 */
export const HYPHEN_OVERRIDES = new Map<string, 'keep' | 'join'>(
  [
    'after-world’s',
    'broad-ways',
    'city-committee',
    'corn-market',
    'court-house',
    'foot-hold',
    'heavy-handed',
    'looking-glass',
    'lovely-lass',
    'pay-the',
    'peace-speech',
    'port-bill',
    'school-boys',
    'school-rooms',
    'sergeants-at-arms',
    'slave-holding',
    'warm-hearted',
    'watch-word',
    'wide-spread',
    'work-bench',
    'co-operation',
    'north-eastwardly',
  ].map((k) => [k, 'keep']),
);

// ------------------------------------------------------------ block building

/** Minimum trimmed length of every line but the last for a block to count as wrapped prose. */
export const PROSE_MIN_LINE = 36;

type Piece = { raw: number; text: string };
type Block = { pieces: Piece[]; afterBreak: boolean };

const TERMINAL = /[.!?:;"”’')\]]$/;
const FOOTNOTE_START = /^(?:\[?\*|[†‡§¶]|!\s|\|\s)/;
/** A column divider the OCR read as `|`, with text on both sides. */
const COLUMN_DIVIDER = /\S\s*\|\s*\S/;
/** Leaves with this many divided lines are set in columns: nothing on them may be unwrapped. */
export const COLUMN_LEAF_MIN = 3;
/** Footnotes and small-print notes are set wider than body text (body lines run to about 59 characters). */
export const WIDE_MEASURE = 60;

const medianLength = (pieces: Piece[]): number => {
  const sorted = pieces.map((p) => p.text.length).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const isWide = (pieces: Piece[]): boolean => medianLength(pieces) >= WIDE_MEASURE;

/** A block of one line has nothing to unwrap; longer blocks must have full-width lines throughout. */
export const isProse = (pieces: Piece[]): boolean =>
  pieces.length === 1 || pieces.slice(0, -1).every((p) => p.text.length >= PROSE_MIN_LINE);

export type CleanContext = {
  lines: string[];
  furniture: FurnitureClass;
  vocab: Map<string, number>;
  /** Raw lines on a leaf set in columns. */
  inColumnLeaf: (i: number) => boolean;
};

export function buildContext(lines: string[], map: LineMap): CleanContext {
  const furniture = classifyFurniture(lines, map);
  const vocab = buildVocabulary(lines, (i) => furniture[i] !== null);
  const dividers = new Map<number, number>();
  lines.forEach((l, i) => {
    if (furniture[i] || !COLUMN_DIVIDER.test(l.trim())) return;
    const leaf = map.lines[i].leaf;
    dividers.set(leaf, (dividers.get(leaf) ?? 0) + 1);
  });
  const inColumnLeaf = (i: number) => (dividers.get(map.lines[i].leaf) ?? 0) >= COLUMN_LEAF_MIN;
  return { lines, furniture, vocab, inColumnLeaf };
}

export type CleanStats = {
  furnitureLines: number;
  blocks: number;
  proseBlocks: number;
  verbatimBlocks: number;
  hyphenJoined: number;
  hyphenKept: number;
  pageMerges: number;
  footnoteBlocks: number;
};

export type CleanResult = { text: string; log: CleanLogEntry[]; stats: CleanStats };

/** Clean raw lines [start, end] (0-based, inclusive) into record text. */
export function cleanRange(ctx: CleanContext, start: number, end: number): CleanResult {
  const log: CleanLogEntry[] = [];
  const stats: CleanStats = {
    furnitureLines: 0,
    blocks: 0,
    proseBlocks: 0,
    verbatimBlocks: 0,
    hyphenJoined: 0,
    hyphenKept: 0,
    pageMerges: 0,
    footnoteBlocks: 0,
  };
  const blocks: Block[] = [];
  let cur: Piece[] = [];
  let pendingBreak = false;
  const flush = () => {
    if (cur.length > 0) {
      blocks.push({ pieces: cur, afterBreak: pendingBreak });
      pendingBreak = false;
      cur = [];
    }
  };
  for (let i = start; i <= end; i++) {
    const raw = ctx.lines[i];
    const kind = ctx.furniture[i];
    if (kind) {
      flush();
      pendingBreak = true;
      stats.furnitureLines++;
      log.push({ rawLine: i + 1, kind, raw: raw.trim(), result: '' });
      continue;
    }
    const text = raw.trim();
    if (text === '') {
      flush();
      continue;
    }
    cur.push({ raw: i, text });
  }
  flush();

  const joinPieces = (a: string, aRaw: number, b: string): string => {
    // a ends with "<letter>-" and b starts with a letter: apply the hyphen rule
    if (/\p{L}-$/u.test(a) && /^\p{L}/u.test(b)) {
      const d = decideHyphen(a.slice(0, -1), b, ctx.vocab);
      const rawJoin = `${/\S+$/.exec(a)?.[0] ?? a}\n${b.split(/\s+/)[0]}`;
      log.push({
        rawLine: aRaw + 1,
        kind: d.keep ? 'hyphen-keep' : 'hyphen-join',
        raw: rawJoin,
        result: d.result,
        reason: d.reason,
      });
      if (d.keep) stats.hyphenKept++;
      else stats.hyphenJoined++;
      return d.keep ? a + b : a.slice(0, -1) + b;
    }
    return a + ' ' + b;
  };

  const unwrap = (pieces: Piece[]): string => {
    let text = pieces[0].text;
    for (let k = 1; k < pieces.length; k++)
      text = joinPieces(text, pieces[k - 1].raw, pieces[k].text);
    return text;
  };

  // Merge paragraphs split by a page break.
  type Out = { pieces: Piece[]; prose: boolean; text?: string; lastRaw: number };
  const out: Out[] = [];
  for (const b of blocks) {
    const prose = isProse(b.pieces) && !b.pieces.some((p) => ctx.inColumnLeaf(p.raw));
    const prev = out.at(-1);
    const prevLast = prev?.pieces.at(-1)?.text ?? '';
    if (
      prev &&
      b.afterBreak &&
      prev.prose &&
      prose &&
      prevLast.length >= PROSE_MIN_LINE &&
      !TERMINAL.test(prevLast) &&
      /^[a-z]/.test(b.pieces[0].text) &&
      !FOOTNOTE_START.test(prev.pieces[0].text) &&
      // the OCR can put a footnote's tail right before the next page's body:
      // different measure means different text, however inviting the hyphen
      isWide(prev.pieces) === isWide(b.pieces)
    ) {
      const prevText = prev.text ?? unwrap(prev.pieces);
      const nextText = unwrap(b.pieces);
      const lastRaw = prev.pieces.at(-1)!.raw;
      const merged = joinPieces(prevText, lastRaw, nextText);
      log.push({
        rawLine: b.pieces[0].raw + 1,
        kind: 'page-merge',
        raw: `${prevLast} | ${b.pieces[0].text}`,
        result: '',
        reason: 'no terminal punctuation before page break, lower-case continuation',
      });
      stats.pageMerges++;
      prev.text = merged;
      prev.pieces = [...prev.pieces, ...b.pieces];
      continue;
    }
    out.push({ pieces: b.pieces, prose, lastRaw: b.pieces.at(-1)!.raw });
  }

  const paras: string[] = [];
  for (const o of out) {
    stats.blocks++;
    if (FOOTNOTE_START.test(o.pieces[0].text)) stats.footnoteBlocks++;
    if (o.text !== undefined) {
      stats.proseBlocks++;
      paras.push(o.text);
    } else if (o.prose) {
      stats.proseBlocks++;
      paras.push(unwrap(o.pieces));
    } else {
      stats.verbatimBlocks++;
      paras.push(o.pieces.map((p) => p.text).join('\n'));
    }
  }
  log.sort((a, b) => a.rawLine - b.rawLine);
  return { text: paras.join('\n\n'), log, stats };
}
