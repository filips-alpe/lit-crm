/** A recorded mention: the span [start, end) of a record's text that names entity `entityId`,
 *  worded `surface` when it was recorded. */
export interface MentionSpan {
  entityId: string;
  start: number;
  end: number;
  surface: string;
}

export type TextSegment = { kind: 'text'; text: string };
export type LinkSegment = { kind: 'link'; text: string; entityId: string };
export type Segment = TextSegment | LinkSegment;

/**
 * Cuts `text` into ordered plain and link segments that together cover it exactly
 * (`segments.map(s => s.text).join('') === text`). A mention is dropped when its range is invalid,
 * when `text.slice(start, end)` no longer equals its `surface` (the record was edited since), or
 * when it overlaps one already kept. Of mentions that start together the longer wins.
 */
export function segmentText(text: string, mentions: readonly MentionSpan[]): Segment[] {
  const sorted = [...mentions].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Segment[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.start < cursor || m.end <= m.start || m.end > text.length) continue;
    if (text.slice(m.start, m.end) !== m.surface) continue;
    if (m.start > cursor) out.push({ kind: 'text', text: text.slice(cursor, m.start) });
    out.push({ kind: 'link', text: m.surface, entityId: m.entityId });
    cursor = m.end;
  }
  if (cursor < text.length) out.push({ kind: 'text', text: text.slice(cursor) });
  return out;
}
