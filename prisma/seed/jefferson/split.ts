/**
 * Splits the two volumes into records. Every raw line belongs to exactly one
 * record: the boundaries are a manifest of data (static line anchors guarded by
 * verbatim text, plus tolerant heading series for the queries, the manual's
 * sections and the Anas), and a record runs from its boundary to the line
 * before the next one. A boundary must be the first line of a text block, so
 * that cleaning each record on its own gives exactly the cleaning of the
 * whole (see split.test.ts).
 *
 * Line numbers in this file are 1-based, as in the cleanup log.
 */
import type { CleanContext } from './clean';
import type { LineMap } from './pages';
import { findVolumeTwoStart } from './pages';

export type PartId =
  | 'autobiography'
  | 'anas'
  | 'notes-on-virginia'
  | 'parliamentary-manual'
  | 'editorial';

export type RecordTypeCode =
  | 'front-matter'
  | 'editorial-note'
  | 'memoir-section'
  | 'memorandum'
  | 'query'
  | 'manual-section'
  | 'correspondence-copy'
  | 'official-paper'
  | 'deposition';

export type Boundary = {
  /** 1-based raw line where the record begins */
  rawLine: number;
  leaf: number;
  page: string;
  /** the raw line's text at the boundary (what was matched) */
  matched: string;
  /** manifest rule that produced it */
  rule: string;
};

export type SplitRecord = {
  key: string;
  part: PartId;
  type: RecordTypeCode;
  title: string;
  description?: string;
  note?: string;
  date?: string;
  /** 1-based, inclusive; the ranges of consecutive records tile the file */
  start: number;
  end: number;
  boundary: Boundary;
};

type Meta = {
  part: PartId;
  type: RecordTypeCode;
  title: string;
  description?: string;
  note?: string;
  date?: string;
};
type Cut = Meta & { line: number; rule: string };

// ------------------------------------------------------------------ manifest

type Anchor = Omit<Meta, 'part' | 'type'> & {
  /** 1-based raw line; `startsWith` is asserted against the trimmed text */
  line: number;
  startsWith?: string;
  part?: PartId;
  type?: RecordTypeCode;
};

const DATASET_TITLE = 'Title supplied by the dataset; the text has no heading here.';
const CONTENTS_TITLE = "Title taken from the volume's contents list; the text is verbatim.";

const defaults = (part: PartId, type: RecordTypeCode, list: Anchor[]): Anchor[] =>
  list.map((a) => ({ part, type, ...a }));

/** Volume I front matter and introductory pieces. */
const FRONT_I: Anchor[] = [
  ...defaults('editorial', 'front-matter', [
    {
      line: 1,
      title: 'Volume I: cover, library stamps and title page',
      note: 'Title supplied by the dataset. Scan residue and library stamps are kept verbatim.',
    },
    {
      line: 130,
      startsWith: 'OFFICERS',
      title: 'Officers of the Thomas Jefferson Memorial Association',
    },
  ]),
  ...defaults('editorial', 'editorial-note', [
    { line: 267, startsWith: 'SPECIAL INTRODUCTION', title: 'Special Introduction' },
    { line: 551, startsWith: "LINCOLN'S TRIBUTE", title: "Lincoln's Tribute to Jefferson" },
  ]),
  ...defaults('editorial', 'front-matter', [
    { line: 715, startsWith: 'CONTENTS', title: 'Contents of Volume I' },
    { line: 843, startsWith: 'ILLUSTRATIONS', title: 'Illustrations in Volume I' },
  ]),
];

/** The Autobiography has no internal headings: topical anchors at paragraph starts. */
const AUTOBIOGRAPHY: Anchor[] = [
  ...defaults('autobiography', 'editorial-note', [
    {
      line: 984,
      startsWith: 'AUTOBIOGRAPHY.',
      title: 'Autobiography: introductory note by the editors',
    },
  ]),
  ...defaults('autobiography', 'memoir-section', [
    {
      line: 1007,
      startsWith: 'JEFFERSON',
      title: 'Autobiography: family, birth and education',
      date: '1821-01-06',
      note: `${DATASET_TITLE} Date as stated at the start of the text (JANUARY 6, 1821).`,
    },
    {
      line: 1124,
      startsWith: 'In 1769, I became a member',
      title:
        'Autobiography: entry into the legislature, 1769, and the early resolutions against Great Britain',
    },
    {
      line: 1298,
      startsWith: 'The next event which excited our sympathies',
      title: 'Autobiography: the Boston port bill of 1774 and the call for a general Congress',
    },
    {
      line: 1484,
      startsWith: 'Mr. Randolph was, according to expectation',
      title: "Autobiography: Congress in 1775 and Lord North's conciliatory propositions",
    },
    {
      line: 1604,
      startsWith: 'On the 15th of May, 1776',
      title: 'Autobiography: the Virginia resolution for independence and the debates in Congress',
    },
    {
      line: 2055,
      startsWith: 'A Declaration by the Representatives',
      title: 'Autobiography: the Declaration of Independence, as drafted and as signed',
    },
    {
      line: 2832,
      startsWith: 'On Friday, July 12, the committee',
      title: 'Autobiography: the debates on the Articles of Confederation',
    },
    {
      line: 3351,
      startsWith: 'Our delegation had been renewed',
      title: 'Autobiography: the revisal of the laws of Virginia',
    },
    {
      line: 3843,
      startsWith: 'The bil for establishing religious freedom',
      title: 'Autobiography: the bill for religious freedom and other acts of the legislature',
    },
    {
      line: 4110,
      startsWith: 'On the 1st of June, 1779',
      title: 'Autobiography: Governor of Virginia, 1779',
    },
    {
      line: 4225,
      startsWith: 'On the 6th of the following month',
      title: 'Autobiography: delegate to Congress, and the money unit',
    },
    {
      line: 4327,
      startsWith: 'The remissness of Congress',
      title: 'Autobiography: Congress at Annapolis and the treaty of peace',
    },
    {
      line: 4701,
      startsWith: 'Before I had left America',
      title: "Autobiography: M. de Marbois's queries, and negotiations in Europe",
    },
    {
      line: 4895,
      startsWith: 'My duties, at Paris',
      title: 'Autobiography: duties at Paris and the proposals concerning the Barbary States',
    },
    {
      line: 5152,
      startsWith: 'The pecuniary distresses of France',
      title: 'Autobiography: the Assembly of Notables and the finances of France',
    },
    {
      line: 5292,
      startsWith: 'The Count de Vergennes had died',
      title: "Autobiography: the ministry after Vergennes's death, and the Dutch Patriots",
    },
    {
      line: 5648,
      startsWith: 'Our first essay, in America',
      title: 'Autobiography: the Federal Convention and the Constitution, and the Dutch loan',
    },
    {
      line: 6054,
      startsWith: 'On my return from Holland',
      title: 'Autobiography: Paris in ferment, and the States General',
    },
    {
      line: 6599,
      startsWith: 'The Assembly now entered on the business',
      title: 'Autobiography: the National Assembly and the Bastile',
    },
    {
      line: 7147,
      startsWith: 'Here I discontinue my relation',
      title:
        'Autobiography: close of the account of the French Revolution, and departure from France',
    },
  ]).map((a) => ({ ...a, note: a.note ?? DATASET_TITLE })),
];

/** Appendix to the Autobiography, Notes A to H. */
const APPENDIX_I: Anchor[] = [
  {
    line: 7399,
    startsWith: 'APPENDIX',
    type: 'correspondence-copy',
    title: 'Appendix to the Autobiography, Note A: letter to John Saunderson, 31 August 1820',
    date: '1820-08-31',
    note: `${CONTENTS_TITLE} Date as stated in the dateline.`,
  },
  {
    line: 7466,
    startsWith: 'NOTES FOR THE BIOGRAPHY',
    type: 'memoir-section',
    title: 'Appendix to the Autobiography: notes for the biography of George Wythe',
    note: CONTENTS_TITLE,
  },
  {
    line: 7609,
    startsWith: '[Note B',
    type: 'correspondence-copy',
    title: 'Appendix to the Autobiography, Note B: letter to Samuel A. Wells, 12 May 1819',
    date: '1819-05-12',
    note: `${CONTENTS_TITLE} Date read from the dateline "May r2, 1819" (OCR "r" for "1").`,
  },
  {
    line: 8008,
    startsWith: '[Nore C',
    type: 'memoir-section',
    title:
      'Appendix to the Autobiography, Note C: on the instructions given to the first delegation of Virginia to Congress',
    note: CONTENTS_TITLE,
  },
  {
    line: 9095,
    startsWith: '[Note D',
    type: 'official-paper',
    title:
      'Appendix to the Autobiography, Note D: instructions for the deputies appointed to meet in General Congress, August 1774',
    note: CONTENTS_TITLE,
  },
  {
    line: 9274,
    startsWith: '[Nore E',
    type: 'correspondence-copy',
    title: 'Appendix to the Autobiography, Note E: letter to George Wythe, 1 November 1778',
    date: '1778-11-01',
    note: `${CONTENTS_TITLE} Date as stated in the dateline.`,
  },
  {
    line: 9357,
    startsWith: 'A Bill for proportioning Crimes',
    type: 'official-paper',
    title:
      'Appendix to the Autobiography, Note E: a bill for proportioning crimes and punishments in cases heretofore capital',
    note: CONTENTS_TITLE,
  },
  {
    line: 10347,
    startsWith: '[NOTE F',
    type: 'memorandum',
    title:
      'Appendix to the Autobiography, Note F: notes on the establishment of a money unit and of a coinage for the United States',
    note: CONTENTS_TITLE,
  },
  {
    line: 10881,
    startsWith: 'Supplementary Explanations',
    type: 'memorandum',
    title: 'Appendix to the Autobiography, Note F: supplementary explanations',
    note: CONTENTS_TITLE,
  },
  {
    line: 11058,
    startsWith: '[Nore G',
    type: 'memoir-section',
    title: "Appendix to the Autobiography, Note G: Jefferson's summary of his own achievements",
    note: CONTENTS_TITLE,
  },
  {
    line: 11182,
    startsWith: '[Note H',
    type: 'correspondence-copy',
    title:
      'Appendix to the Autobiography, Note H: letter from George Washington to Thomas Jefferson, 13 October 1789',
    date: '1789-10-13',
    note: `${CONTENTS_TITLE} Date as stated in the dateline. The letter's postscript, signed G. W., is in this record.`,
  },
  {
    line: 11266,
    startsWith: 'New YORK, November 30, 1789',
    type: 'correspondence-copy',
    title:
      'Appendix to the Autobiography, Note H: letter from George Washington to Thomas Jefferson, 30 November 1789',
    date: '1789-11-30',
    note: `${CONTENTS_TITLE} Date as stated in the dateline.`,
  },
].map((a) => ({ part: 'autobiography' as PartId, ...a })) as Anchor[];

/** The Anas, outside the heading series. */
const ANAS_STATIC: Anchor[] = [
  {
    line: 11303,
    startsWith: 'THE ANAS',
    part: 'anas',
    type: 'editorial-note',
    title: 'The Anas: introductory note by the editors',
  },
  {
    line: 11348,
    startsWith: 'THE ANAS',
    part: 'anas',
    type: 'memorandum',
    title: 'The Anas: explanation of the three volumes bound in marbled paper',
    date: '1818-02-04',
    note: 'Title taken from the heading of the text. Date as stated at the end of the text ("February 4th, 1818").',
  },
];

/** Volume II front matter and the Notes on Virginia's own front. */
const FRONT_II: Anchor[] = [
  {
    line: 0, // resolved: first line of the volume II title page
    title: 'Volume II: title page',
    part: 'editorial',
    type: 'front-matter',
    note: 'Title supplied by the dataset. Scan residue kept verbatim.',
  },
  {
    line: 20008,
    startsWith: 'THE UNIVERSITY OF VIRGINIA',
    part: 'editorial',
    type: 'editorial-note',
    title:
      'The University of Virginia, and Thomas Jefferson, its father (address by James C. Carter)',
  },
  {
    line: 21342,
    startsWith: 'CONTENTS',
    part: 'editorial',
    type: 'front-matter',
    title: 'Contents of Volume II',
  },
  {
    line: 21582,
    startsWith: 'IELUSTRATIONS',
    part: 'editorial',
    type: 'front-matter',
    title: 'Illustrations in Volume II',
    note: 'Title supplied by the dataset; the printed heading is OCR-damaged (IELUSTRATIONS).',
  },
  {
    line: 21609,
    startsWith: 'NOTES ON VIRGINIA',
    part: 'notes-on-virginia',
    type: 'editorial-note',
    title: 'Notes on Virginia: introductory notes by the editors',
  },
];

/** Appendix to the Notes on Virginia, and the Logan appendix. */
const APPENDIX_II: Anchor[] = [
  ...defaults('notes-on-virginia', 'memorandum', [
    {
      line: 33861,
      startsWith: 'APPENDIX',
      title: 'Appendix to the Notes on Virginia, No. I: observations by Charles Thompson',
      note: CONTENTS_TITLE,
    },
  ]),
  ...defaults('notes-on-virginia', 'official-paper', [
    {
      line: 34534,
      startsWith: 'In the summer of the year 1783',
      title:
        'Appendix to the Notes on Virginia, No. II: draft of a fundamental constitution for the Commonwealth of Virginia',
      note: `${CONTENTS_TITLE} The heading line is missing from the OCR.`,
    },
    {
      line: 35259,
      startsWith: 'An Act for establishing Religious Freedom',
      title:
        'Appendix to the Notes on Virginia, No. III: an act for establishing religious freedom, 1786',
      note: CONTENTS_TITLE,
    },
  ]),
  ...defaults('notes-on-virginia', 'memorandum', [
    {
      line: 35369,
      startsWith: 'AN APPENDIX RELATIVE TO THE MURDER',
      title:
        "Appendix to the Notes on Virginia, No. IV: an appendix relative to the murder of Logan's family",
      note: CONTENTS_TITLE,
    },
  ]),
  ...defaults('notes-on-virginia', 'correspondence-copy', [
    {
      line: 35499,
      startsWith: 'Extract of a letter from the Honorable',
      title: 'Logan appendix: extract of a letter from Judge Innes to Thomas Jefferson',
      note: CONTENTS_TITLE,
    },
    {
      line: 35637,
      startsWith: 'Extract of a letter from Col. Ebenezer Zane',
      title: 'Logan appendix: extract of a letter from Col. Ebenezer Zane to John Brown',
      note: CONTENTS_TITLE,
    },
  ]),
  ...defaults('notes-on-virginia', 'deposition', [
    {
      line: 35540,
      startsWith: 'ALLEGHANY COUNTY',
      title: 'Logan appendix: affidavit of John Gibson',
      note: CONTENTS_TITLE,
    },
    {
      line: 35703,
      startsWith: 'The certificate of William Huston',
      title: 'Logan appendix: certificate of William Huston',
      note: CONTENTS_TITLE,
    },
    {
      line: 35745,
      startsWith: 'The certificate of',
      title: 'Logan appendix: certificate of Jacob Newland',
      note: CONTENTS_TITLE,
    },
    {
      line: 35768,
      startsWith: 'The Certificate of',
      title: 'Logan appendix: certificate of John Anderson',
      note: CONTENTS_TITLE,
    },
    {
      line: 35803,
      startsWith: 'The Deposition of James Chambers',
      title: 'Logan appendix: deposition of James Chambers',
      note: CONTENTS_TITLE,
    },
    {
      line: 35896,
      startsWith: 'WASHINGTON COUNTY',
      title: 'Logan appendix: certificate of David Reddick',
      note: CONTENTS_TITLE,
    },
    {
      line: 35913,
      startsWith: 'The certificate of Charles Polke',
      title: 'Logan appendix: certificate of Charles Polke',
      note: CONTENTS_TITLE,
    },
    {
      line: 35943,
      startsWith: 'The Declaration of the Hon.',
      title: 'Logan appendix: declaration of the Honorable Judge Innes',
      note: CONTENTS_TITLE,
    },
    {
      line: 35972,
      startsWith: 'The Declaration of William Robinson',
      title: 'Logan appendix: declaration of William Robinson',
      note: CONTENTS_TITLE,
    },
    {
      line: 36060,
      startsWith: 'The deposition of Colonel William',
      title: "Logan appendix: deposition of Col. William M'Kee",
      note: CONTENTS_TITLE,
    },
    {
      line: 36098,
      startsWith: 'DANVILLE',
      title: 'Logan appendix: certificate of James Speed, Junior, and J. H. Dewees',
      note: CONTENTS_TITLE,
    },
    {
      line: 36105,
      startsWith: 'The Certificate of the Honorable Stevens',
      title: 'Logan appendix: certificate of the Honorable Stevens Thompson Mason',
      note: CONTENTS_TITLE,
    },
    {
      line: 36123,
      startsWith: 'A copy of Logan’s speech, given by',
      title: "Logan appendix: copy of Logan's speech given by General Mercer to Lewis Willis",
      note: DATASET_TITLE,
    },
    {
      line: 36134,
      startsWith: "A copy of Logan's speech from the Notes",
      title: 'Logan appendix: statement of Andrew Rodgers on the speech of Logan to Lord Dunmore',
      note: CONTENTS_TITLE,
    },
    {
      line: 36154,
      startsWith: 'The declaration of Mr. John Heckewelder',
      title: 'Logan appendix: declaration of John Heckewelder',
      note: CONTENTS_TITLE,
    },
  ]),
  ...defaults('notes-on-virginia', 'memorandum', [
    {
      line: 36357,
      startsWith: 'From this testimony the following',
      title: 'Logan appendix: historical statement drawn from the testimony',
      note: CONTENTS_TITLE,
    },
  ]),
  ...defaults('notes-on-virginia', 'deposition', [
    {
      line: 36481,
      startsWith: 'The declaration of',
      title: 'Logan appendix: declaration of John Sappington',
      note: CONTENTS_TITLE,
    },
    {
      line: 36593,
      startsWith: 'ManisoN County',
      title: "Logan appendix: certificate of Samuel M'Kee, Junior",
      note: CONTENTS_TITLE,
    },
  ]),
];

/** The Parliamentary Manual outside the section series. */
const MANUAL_STATIC: Anchor[] = [
  {
    line: 36620,
    startsWith: 'A MANUAL',
    part: 'parliamentary-manual',
    type: 'front-matter',
    title: 'A Manual of Parliamentary Practice: title page',
    note: DATASET_TITLE,
  },
  {
    line: 36655,
    startsWith: 'INTRODUCTION',
    part: 'parliamentary-manual',
    type: 'editorial-note',
    title: 'A Manual of Parliamentary Practice: introduction',
    note: 'Title taken from the heading of the text.',
  },
  {
    line: 41604,
    part: 'parliamentary-manual',
    type: 'front-matter',
    title: 'End of Volume II: library catalogue card and scan residue',
    note: 'Title supplied by the dataset. Scan residue kept verbatim.',
  },
];

export const STATIC_ANCHORS: Anchor[] = [
  ...FRONT_I,
  ...AUTOBIOGRAPHY,
  ...APPENDIX_I,
  ...ANAS_STATIC,
  ...FRONT_II,
  ...APPENDIX_II,
  ...MANUAL_STATIC,
];

// -------------------------------------------------------------- text helpers

const SMALL = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

export function titleCase(s: string): string {
  const words = s
    .replace(/[^\p{L}\p{N}?&)]+$/u, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ');
  return words
    .map((w, i) => {
      if (/^[ivxlc]+$/.test(w) && w.length > 1) return w.toUpperCase();
      return i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

const isUpperLine = (t: string): boolean => {
  const letters = t.replace(/[^A-Za-z]/g, '');
  return letters.length >= 3 && t.replace(/[^A-Z]/g, '').length / letters.length > 0.8;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_RE =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const DAY_RE = '[\\dIiOoTrsgt]{1,3}(?:st|nd|rd|th|d)?';
const YEAR_RE = '[\\dIlt][\\dIlOot]{3}';
const WEEKDAY = '(?:(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,? )?';
/** A memorandum's opening date: `March the 7th.`, `December the 25th, 1791, Colonel`, `November, 1792.` */
export const DATE_START = new RegExp(
  `^(${WEEKDAY})(${MONTH_RE})\\.?(?:,? ?(?:the\\b\\.?\\s*)?(${DAY_RE}))?(?:[,.;]? ?(${YEAR_RE}))?\\s*([.;,])`,
);

const DIGIT_FIX: Record<string, string> = {
  r: '1',
  I: '1',
  i: '1',
  l: '1',
  t: '1',
  T: '1',
  O: '0',
  o: '0',
};
const fixDigits = (s: string): string => s.replace(/[rIilTtOo]/g, (c) => DIGIT_FIX[c] ?? c);

/** Day of the month from an OCR-read day word; null unless the reading is unambiguous. */
export function parseDay(raw: string): number | null {
  const m = /^(.*?)(st|nd|rd|th|d)?$/.exec(raw)!;
  let digits = m[1];
  const suffix = m[2] ?? '';
  // `sth` is 5th and `gth` 9th; a bare `o` or `s`/`g` elsewhere is not read
  if (/^[sg]$/.test(digits) && suffix === 'th') digits = digits === 's' ? '5' : '9';
  else if (/^\d[sg]$/.test(digits) && suffix === 'th')
    digits = digits[0] + (digits[1] === 's' ? '5' : '9');
  if (!/^[\dIilrTtOo]+$/.test(digits)) return null;
  if (/^[oO]/.test(digits)) return null;
  const n = Number(fixDigits(digits));
  if (!(n >= 1 && n <= 31)) return null;
  const want =
    n % 10 === 1 && n !== 11
      ? ['st']
      : n % 10 === 2 && n !== 12
        ? ['nd', 'd']
        : n % 10 === 3 && n !== 13
          ? ['rd', 'd']
          : ['th'];
  if (suffix !== '' && !want.includes(suffix)) return null;
  return n;
}

export function parseYear(raw: string): number | null {
  const n = Number(fixDigits(raw));
  return Number.isInteger(n) && n >= 1700 && n <= 1830 ? n : null;
}

export type DateStart = {
  /** the printed opening phrase, verbatim */
  printed: string;
  month: number;
  day: number | null;
  year: number | null;
  /** ISO date, only when day and year are both read without ambiguity */
  iso: string | null;
  /** clean label, e.g. `10 March 1792`; month and year only when the day cannot be read */
  label: string;
};

export function parseDateStart(text: string): DateStart | null {
  const m = DATE_START.exec(text.trim());
  if (!m) return null;
  const [whole, , monthWord, dayRaw, yearRaw, punct] = m;
  // `Month, YYYY,` is a sentence, not a heading; so is a bare month word
  if (punct === ',' && dayRaw === undefined) return null;
  if (dayRaw === undefined && yearRaw === undefined) return null;
  const month = MONTHS.findIndex((n) =>
    n.toLowerCase().startsWith(monthWord.toLowerCase().slice(0, 3)),
  );
  if (month < 0) return null;
  const printed = whole.replace(/[.;,]$/, '').trim();
  const day = dayRaw === undefined ? null : parseDay(dayRaw);
  if (dayRaw !== undefined && day === null) {
    // an unreadable day: still a memorandum start, but no ISO date
    const year = yearRaw ? parseYear(yearRaw) : null;
    return {
      printed,
      month,
      day: null,
      year,
      iso: null,
      label: [MONTHS[month], year].filter((x) => x !== null).join(' '),
    };
  }
  const year = yearRaw === undefined ? null : parseYear(yearRaw);
  if (yearRaw !== undefined && year === null) return null;
  const iso =
    day !== null && year !== null
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : null;
  const label = [day, MONTHS[month], year].filter((x) => x !== null).join(' ');
  return { printed, month, day, year, iso, label };
}

// ------------------------------------------------------------------- series

export type SplitInput = { lines: string[]; map: LineMap; ctx: CleanContext };

/** Block starts in clean's sense: non-blank, not furniture, first line after a gap or furniture. */
export function blockStarts(input: SplitInput): boolean[] {
  const { lines, ctx } = input;
  return lines.map(
    (l, i) =>
      l.trim() !== '' &&
      !ctx.furniture[i] &&
      (i === 0 || lines[i - 1].trim() === '' || ctx.furniture[i - 1] !== null),
  );
}

/** Lines of a heading: the start line and following non-blank lines passing `more`, at most `max`. */
function headingLines(
  lines: string[],
  i: number,
  more: (t: string) => boolean,
  max = 3,
): { text: string; lines: number[] } {
  const out = [i];
  for (let j = i + 1; j < lines.length && out.length < max; j++) {
    const t = lines[j].trim();
    if (t === '' || !more(t)) break;
    out.push(j);
  }
  return { text: out.map((k) => lines[k].trim()).join(' '), lines: out };
}

/** Fixes for OCR damage in a title only (the record text is never touched). */
const TITLE_FIXES: [RegExp, string][] = [
  [/\boj\b/g, 'of'],
  [/\btts\b/g, 'its'],
  [/\bthetr\b/g, 'their'],
  [/\bpares\b/g, 'parts'],
  [/\bCc\.$/, '&c.'],
  [/\s+\?/g, '?'],
  [/\bAMENDM ENTS\b/, 'AMENDMENTS'],
  [/\bhow jar\b/, 'how far'],
];
export function fixTitle(s: string): { title: string; fixed: boolean } {
  let t = s.replace(/\s+/g, ' ').trim();
  let fixed = false;
  for (const [re, to] of TITLE_FIXES) {
    const n = t.replace(re, to);
    if (n !== t) fixed = true;
    t = n;
  }
  return { title: t, fixed };
}

const ROMAN = (n: number): string => {
  const t: [number, string][] = [
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of t) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
};

export const EXPECTED_QUERIES = 23;
export const EXPECTED_SECTIONS = 53;
const QUERY_HEAD = /^[QO]UER[YV]\b/;
const SECTION_HEAD = /^SE[CG]TION[^a-z]{0,6}[IVXLCl1]{0,8}[^a-z]{0,3}$/;
const ANAS_HEAD =
  /^(?:CONVERSATIONS? WITH|CABINET MEETINGS|CONFERENCES? (?:OF|WITH)|MEMORANDUM OF A MEETING|REASONS FOR|COPY OF A MINUTE|A RECAPITULATION OF|DINNER WITH)/;

type Range = [number, number];

/**
 * A series' first record starts at the running title above its heading, not at the heading itself.
 * `guard` is asserted against the trimmed text of the overriding line.
 */
const SERIES_STARTS: { rule: string; n: number; line: number; guard: string }[] = [
  { rule: 'query-series', n: 1, line: 21728, guard: 'JEFFERSON' },
  { rule: 'section-series', n: 1, line: 36740, guard: 'A MANUAL OF PARLIAMENTARY' },
];
function startOf(lines: string[], rule: string, n: number, heading: number): number {
  const o = SERIES_STARTS.find((s) => s.rule === rule && s.n === n);
  if (!o) return heading;
  const text = lines[o.line - 1]?.trim() ?? '';
  if (!text.startsWith(o.guard)) throw new Error(`${rule} ${n}: line ${o.line} is "${text}"`);
  return o.line;
}

function querySeries(input: SplitInput, starts: boolean[], range: Range): Cut[] {
  const cuts: Cut[] = [];
  const { lines } = input;
  for (let i = range[0] - 1; i < range[1]; i++) {
    const t = lines[i].trim();
    if (!starts[i] || !QUERY_HEAD.test(t)) continue;
    const n = cuts.length + 1;
    // the printed question follows the heading, skipping stray single marks
    let j = i + 1;
    while (j < lines.length && (lines[j].trim() === '' || lines[j].trim().length < 4)) j++;
    const q = headingLines(lines, j, () => true, 4);
    const raw = q.text.replace(/\s+/g, ' ');
    const { title: question, fixed } = fixTitle(raw);
    cuts.push({
      line: startOf(lines, 'query-series', n, i + 1),
      rule: 'query-series',
      part: 'notes-on-virginia',
      type: 'query',
      title: `Query ${ROMAN(n)}: ${question}`,
      description: raw,
      note: [
        `Heading read as query ${n} (${ROMAN(n)}) by its position in the series; printed heading "${t}".`,
        fixed ? `Title corrects OCR damage in the printed question; the text is verbatim.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
  }
  return cuts;
}

function sectionSeries(input: SplitInput, starts: boolean[], range: Range): Cut[] {
  const cuts: Cut[] = [];
  const { lines } = input;
  for (let i = range[0] - 1; i < range[1]; i++) {
    const t = lines[i].trim();
    if (!starts[i] || !SECTION_HEAD.test(t)) continue;
    const n = cuts.length + 1;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    const subject = headingLines(lines, j, isUpperLine, 2).text;
    const fixed = fixTitle(subject);
    cuts.push({
      line: startOf(lines, 'section-series', n, i + 1),
      rule: 'section-series',
      part: 'parliamentary-manual',
      type: 'manual-section',
      title: `Section ${n}: ${titleCase(fixed.title)}`,
      note: `Heading read as section ${n} (${ROMAN(n)}) by its position in the series; printed heading "${t}".`,
    });
  }
  return cuts;
}

function anasSeries(input: SplitInput, starts: boolean[], range: Range): Cut[] {
  const { lines } = input;
  type Ev = { i: number; kind: 'heading' | 'date'; text: string; span: number[] };
  const events: Ev[] = [];
  for (let i = range[0] - 1; i < range[1]; i++) {
    if (!starts[i]) continue;
    const t = lines[i].trim();
    if (ANAS_HEAD.test(t)) {
      const h = headingLines(lines, i, isUpperLine, 4);
      events.push({ i, kind: 'heading', text: h.text, span: h.lines });
    } else if (parseDateStart(t)) {
      events.push({ i, kind: 'date', text: t, span: [i] });
    }
  }
  const cuts: Cut[] = [];
  let section = 'The Anas';
  for (let k = 0; k < events.length; k++) {
    const e = events[k];
    const next = events[k + 1];
    if (e.kind === 'heading') {
      section = titleCase(e.text);
      const merged =
        next &&
        next.kind === 'date' &&
        // only the heading's own lines (and blanks) lie between heading and date
        lines.slice(e.span.at(-1)! + 1, next.i).every((l) => l.trim() === '');
      const d = merged ? parseDateStart(next.text) : null;
      cuts.push({
        line: e.i + 1,
        rule: 'anas-heading',
        part: 'anas',
        type: 'memorandum',
        title: d ? `${section}: ${d.label}` : section,
        ...(d ? { description: d.printed, ...(d.iso ? { date: d.iso } : {}) } : {}),
        note: d
          ? `Heading and dated opening read together${d.iso ? '' : '; date not stated in full, so none recorded'}.`
          : 'Title taken from the heading of the text; no date is printed with it.',
      });
      if (merged) k++;
      continue;
    }
    const d = parseDateStart(e.text)!;
    cuts.push({
      line: e.i + 1,
      rule: 'anas-date',
      part: 'anas',
      type: 'memorandum',
      title: `${section}: ${d.label}`,
      description: d.printed,
      ...(d.iso ? { date: d.iso } : {}),
      note: d.iso
        ? 'Date as printed at the start of the memorandum (OCR digit slips such as "r" for "1" read through).'
        : 'Date not stated in full at the start of the text, so none recorded; title uses the date as printed.',
    });
  }
  return cuts;
}

// -------------------------------------------------------------------- split

const pad = (n: number) => String(n).padStart(4, '0');

export function buildSplit(input: SplitInput): {
  records: SplitRecord[];
  counts: Record<string, number>;
} {
  const { lines, map } = input;
  const total = lines.length;
  const starts = blockStarts(input);
  const volTwo = findVolumeTwoStart(lines) + 1;

  const cuts: Cut[] = [];
  for (const a of STATIC_ANCHORS) {
    const line = a.line === 0 ? volTwo : a.line;
    if (a.startsWith !== undefined) {
      const text = lines[line - 1]?.trim() ?? '';
      if (!text.startsWith(a.startsWith)) {
        throw new Error(
          `anchor line ${line}: expected "${a.startsWith}", found "${text.slice(0, 60)}"`,
        );
      }
    }
    const meta: Partial<Anchor> = { ...a };
    delete meta.startsWith;
    delete meta.line;
    cuts.push({ ...(meta as Meta), line, rule: 'static-anchor' });
  }
  const queries = querySeries(input, starts, [volTwo, total]);
  const sections = sectionSeries(input, starts, [volTwo, total]);
  const anas = anasSeries(input, starts, [11348, volTwo - 1]);
  if (queries.length !== EXPECTED_QUERIES) throw new Error(`found ${queries.length} queries`);
  if (sections.length !== EXPECTED_SECTIONS)
    throw new Error(`found ${sections.length} manual sections`);
  cuts.push(...queries, ...sections, ...anas);

  cuts.sort((a, b) => a.line - b.line);
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i].line === cuts[i - 1].line)
      throw new Error(`two boundaries at line ${cuts[i].line}`);
  }
  if (cuts[0].line !== 1) throw new Error('first boundary must be line 1');
  for (const c of cuts) {
    if (c.line !== 1 && !starts[c.line - 1]) {
      throw new Error(`boundary at line ${c.line} is not a block start`);
    }
  }

  const records: SplitRecord[] = cuts.map((c, i) => {
    const pos = map.lines[c.line - 1];
    const { line, rule, ...meta } = c;
    return {
      key: `jefferson-rec-${pad(i + 1)}`,
      ...meta,
      start: line,
      end: i + 1 < cuts.length ? cuts[i + 1].line - 1 : total,
      boundary: {
        rawLine: line,
        leaf: pos.leaf,
        page: pos.page,
        matched: lines[line - 1].trim(),
        rule,
      },
    };
  });
  // identical titles (two memoranda dated alike) stay distinguishable
  const byTitle = new Map<string, SplitRecord[]>();
  for (const r of records) byTitle.set(r.title, [...(byTitle.get(r.title) ?? []), r]);
  for (const group of byTitle.values()) {
    if (group.length > 1)
      group.forEach((r, k) => (r.title = `${r.title} (${k + 1} of ${group.length})`));
  }
  const counts: Record<string, number> = {};
  for (const r of records) counts[r.type] = (counts[r.type] ?? 0) + 1;
  return { records, counts };
}
