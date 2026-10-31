/**
 * Raw djvu line -> {leaf, page, volume}.
 *
 * The djvu text and the hOCR search text carry identical characters once all
 * whitespace is removed, and the page index gives each leaf's character range
 * in the search text. Counting non-whitespace characters therefore places every
 * raw djvu line on its exact leaf.
 */
export type LinePosition = {
  /** Internet Archive leaf number (page index position). */
  leaf: number;
  /** Printed page label from page_numbers.json; '' when the leaf has none. */
  page: string;
  volume: 1 | 2;
};

export type LineMap = {
  lines: LinePosition[];
  /** Lines whose characters span more than one leaf (assigned to their first leaf). */
  straddling: number[];
};

const nonWs = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (
      !(
        c === 32 ||
        (c >= 9 && c <= 13) ||
        c === 160 ||
        c === 0x2028 ||
        c === 0x2029 ||
        c === 0xfeff
      )
    )
      n++;
  }
  return n;
};

/** 0-based index of the second "THE WRITINGS OF" title line, where Volume II starts. */
export function findVolumeTwoStart(lines: string[]): number {
  const idx: number[] = [];
  lines.forEach((l, i) => {
    if (/^THE WRITINGS OF\s*$/.test(l)) idx.push(i);
  });
  if (idx.length < 2) throw new Error('volume II title page not found');
  return idx[1];
}

export function mapLines(
  djvu: string,
  searchtext: string,
  pageindex: number[][],
  pageLabels: Map<number, string>,
): LineMap {
  const lines = djvu.split('\n');
  const volumeTwoStart = findVolumeTwoStart(lines);
  // Non-whitespace characters up to the end of each leaf.
  const nsEnd: number[] = [];
  let prevEnd = 0;
  let count = 0;
  for (const [, end] of pageindex) {
    count += nonWs(searchtext.slice(prevEnd, end));
    prevEnd = end;
    nsEnd.push(count);
  }
  const total = nonWs(searchtext);
  const out: LinePosition[] = [];
  const straddling: number[] = [];
  let k = 0;
  let consumed = 0;
  const leafOf = (c: number): number => {
    while (k < nsEnd.length - 1 && nsEnd[k] <= c) k++;
    return k;
  };
  let lastLeaf = -1;
  const pending: number[] = []; // blank lines before the first non-blank line
  lines.forEach((line, i) => {
    const n = nonWs(line);
    const volume: 1 | 2 = i >= volumeTwoStart ? 2 : 1;
    if (n === 0) {
      if (lastLeaf < 0) pending.push(i);
      out.push({ leaf: Math.max(lastLeaf, 0), page: '', volume });
      return;
    }
    const first = leafOf(consumed);
    // does the last character fall on a later leaf?
    let kk = first;
    while (kk < nsEnd.length - 1 && nsEnd[kk] <= consumed + n - 1) kk++;
    if (kk !== first) straddling.push(i);
    consumed += n;
    lastLeaf = first;
    out.push({ leaf: first, page: '', volume });
  });
  if (consumed !== total) {
    throw new Error(`djvu has ${consumed} non-whitespace chars, search text ${total}`);
  }
  // Leading blank lines belong to the first real leaf.
  const firstLeaf = out.find((_, i) => !pending.includes(i))?.leaf ?? 0;
  for (const i of pending) out[i].leaf = firstLeaf;
  for (const p of out) p.page = pageLabels.get(p.leaf) ?? '';
  return { lines: out, straddling };
}
