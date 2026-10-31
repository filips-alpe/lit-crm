import { describe, expect, it } from 'vitest';
import { segmentText, type MentionSpan } from './mentionSegments';

const m = (entityId: string, start: number, end: number, surface: string): MentionSpan => ({
  entityId,
  start,
  end,
  surface,
});
const join = (segs: { text: string }[]) => segs.map((s) => s.text).join('');

describe('segmentText', () => {
  it('returns one text segment when there are no mentions, none for empty text', () => {
    expect(segmentText('hello', [])).toEqual([{ kind: 'text', text: 'hello' }]);
    expect(segmentText('', [])).toEqual([]);
    expect(segmentText('', [m('e', 0, 0, '')])).toEqual([]);
  });

  it('splits text around links in order, regardless of input order', () => {
    const text = 'Jefferson wrote to Madison.';
    const segs = segmentText(text, [m('mad', 19, 26, 'Madison'), m('jef', 0, 9, 'Jefferson')]);
    expect(segs).toEqual([
      { kind: 'link', text: 'Jefferson', entityId: 'jef' },
      { kind: 'text', text: ' wrote to ' },
      { kind: 'link', text: 'Madison', entityId: 'mad' },
      { kind: 'text', text: '.' },
    ]);
    expect(join(segs)).toBe(text);
  });

  it('keeps adjacent links with no text between them', () => {
    const segs = segmentText('AB', [m('a', 0, 1, 'A'), m('b', 1, 2, 'B')]);
    expect(segs.map((s) => s.kind)).toEqual(['link', 'link']);
  });

  it('drops a mention whose slice no longer equals its surface (edited text)', () => {
    const text = 'Dear Madison';
    const segs = segmentText(text, [m('mad', 5, 12, 'Madisom')]);
    expect(segs).toEqual([{ kind: 'text', text }]);
  });

  it('drops out-of-range, empty and negative spans', () => {
    const text = 'abc';
    expect(segmentText(text, [m('x', 2, 9, 'c'), m('y', 1, 1, ''), m('z', -1, 1, 'a')])).toEqual([
      { kind: 'text', text },
    ]);
  });

  it('drops the later of two overlapping mentions and keeps the earlier', () => {
    const text = 'New York State';
    const segs = segmentText(text, [m('state', 4, 14, 'York State'), m('ny', 0, 8, 'New York')]);
    expect(segs).toEqual([
      { kind: 'link', text: 'New York', entityId: 'ny' },
      { kind: 'text', text: ' State' },
    ]);
  });

  it('prefers the longer span when two start together', () => {
    const segs = segmentText('New York', [m('a', 0, 3, 'New'), m('b', 0, 8, 'New York')]);
    expect(segs).toEqual([{ kind: 'link', text: 'New York', entityId: 'b' }]);
  });

  it('keeps newlines and spacing exactly; concatenation equals the text', () => {
    const text = 'line one\n\n  Adams,\nHamilton';
    const segs = segmentText(text, [m('h', 19, 27, 'Hamilton'), m('a', 12, 17, 'Adams')]);
    expect(join(segs)).toBe(text);
  });
});
