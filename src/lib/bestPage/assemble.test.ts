import { describe, expect, it } from 'vitest';
import { buildBestPage, mentionContext, segmentText, type BestPageInput } from './assemble';

describe('segmentText', () => {
  const text = 'Th: Jefferson mentioned to him a letter from John Adams.';
  const spans = [
    { start: 0, end: 13, entityId: 'tj' },
    { start: 45, end: 55, entityId: 'ja' },
  ];

  it('links the mention spans', () => {
    expect(segmentText(text, spans)).toEqual([
      { text: 'Th: Jefferson', entityId: 'tj', entityTitle: undefined },
      { text: ' mentioned to him a letter from ' },
      { text: 'John Adams', entityId: 'ja', entityTitle: undefined },
      { text: '.' },
    ]);
  });

  it('never changes the wording: segments join back to the text', () => {
    const noisy = [
      ...spans,
      { start: 5, end: 9, entityId: 'x' },
      { start: -1, end: 3, entityId: 'y' },
      { start: 50, end: 999, entityId: 'z' },
    ];
    expect(
      segmentText(text, noisy)
        .map((s) => s.text)
        .join(''),
    ).toBe(text);
  });

  it('returns the text whole when nothing is mentioned', () => {
    expect(segmentText('plain', [])).toEqual([{ text: 'plain' }]);
  });
});

describe('mentionContext', () => {
  it('cuts whole words around the mention from a slice', () => {
    const slice =
      'xxx the President called on me and said that Hamilton had advised him to wait for news';
    const start = 1000 + slice.indexOf('Hamilton');
    const ctx = mentionContext(slice, start, start + 8, 1000, 20);
    expect(ctx.match).toBe('Hamilton');
    expect(ctx.before).toBe('…me and said that ');
    expect(ctx.after).toBe(' had advised him to…');
  });
});

const ref = (id: string, title: string, typeCode = 'person') => ({
  id,
  title,
  typeCode,
  typeColor: '#000',
  date: null,
});

function input(over: Partial<BestPageInput> = {}): BestPageInput {
  return {
    record: {
      id: 'e1',
      title: 'Alexander Hamilton',
      description: null,
      text: null,
      references: [],
      date: null,
    },
    type: {
      code: 'person',
      color: '#ad1457',
      layout: {
        fields: [
          { id: 'title', label: 'Name', kind: 'text', writeTo: 'title' },
          { id: 'description', label: 'Description', kind: 'text', writeTo: 'description' },
          { id: 'refs', label: 'Sources', kind: 'list', writeTo: 'references' },
        ],
      },
    },
    outgoing: [],
    named: [],
    incoming: [],
    incomingTotal: 0,
    related: [],
    children: [],
    ...over,
  };
}

const kinds = (i: BestPageInput) => buildBestPage(i).sections.map((s) => s.kind);

describe('buildBestPage', () => {
  it('omits every section without data', () => {
    expect(kinds(input())).toEqual([]);
  });

  it('builds an entity page from mentions, co-mentions and sources', () => {
    const source = ref('d1', 'The Anas: Conversation with Alexander Hamilton', 'memorandum');
    const page = buildBestPage(
      input({
        record: {
          ...input().record,
          description: 'Secretary of the Treasury',
          references: ['https://archive.org/details/x'],
        },
        incoming: [
          { source, start: 9, end: 17, slice: 'Notes of Hamilton here', sliceStart: 0 },
          { source, start: 9, end: 17, slice: 'Notes of Hamilton again', sliceStart: 0 },
        ],
        incomingTotal: 2,
        related: [{ ...ref('e2', 'Thomas Jefferson'), count: 1 }],
      }),
    );
    expect(page.sections.map((s) => s.kind)).toEqual(['facts', 'mentions', 'related', 'sources']);
    const mentions = page.sections.find((s) => s.kind === 'mentions');
    expect(mentions).toMatchObject({
      total: 2,
      more: 0,
      groups: [{ count: 2, source: { id: 'd1' } }],
    });
  });

  it('builds a document page with linked text and the names it mentions, by the same rules', () => {
    const page = buildBestPage(
      input({
        record: {
          id: 'd1',
          title: 'Anas',
          text: 'Hamilton and Hamilton and Knox',
          references: [],
          from: 'Thomas Jefferson',
        },
        type: {
          code: 'memorandum',
          color: '#000',
          layout: {
            fields: [
              { id: 'from', label: 'Author', kind: 'text', writeTo: 'from' },
              { id: 'body', label: 'Text', kind: 'text', writeTo: 'text' },
            ],
          },
        },
        outgoing: [
          { start: 0, end: 8, entityId: 'e1' },
          { start: 13, end: 21, entityId: 'e1' },
          { start: 26, end: 30, entityId: 'e3' },
        ],
        named: [ref('e1', 'Alexander Hamilton'), ref('e3', 'Henry Knox')],
      }),
    );
    expect(page.sections.map((s) => s.kind)).toEqual(['facts', 'text', 'mentioned']);
    expect(page.sections[0]).toEqual({
      kind: 'facts',
      facts: [{ label: 'Author', value: { kind: 'text', value: 'Thomas Jefferson' } }],
    });
    const mentioned = page.sections.find((s) => s.kind === 'mentioned');
    expect(
      mentioned && 'entities' in mentioned && mentioned.entities.map((e) => [e.id, e.count]),
    ).toEqual([
      ['e1', 2],
      ['e3', 1],
    ]);
  });

  it('leaves the text heading to the page when the type has no body field label', () => {
    const page = buildBestPage(
      input({
        record: { ...input().record, text: 'Body' },
        type: {
          code: 'x',
          color: '#000',
          layout: { fields: [{ id: 't', label: 'Title', kind: 'text', writeTo: 'title' }] },
        },
      }),
    );
    expect(page.sections).toEqual([{ kind: 'text', label: null, segments: [{ text: 'Body' }] }]);
  });

  it('caps the source groups and counts the rest', () => {
    const incoming = Array.from({ length: 5 }, (_, i) => ({
      source: ref(`d${i}`, `Doc ${i}`),
      start: 0,
      end: 1,
      slice: 'x',
      sliceStart: 0,
    }));
    const page = buildBestPage(
      input({ incoming, incomingTotal: 5, limits: { groups: 2, contexts: 1 } }),
    );
    expect(page.sections.find((s) => s.kind === 'mentions')).toMatchObject({ more: 3 });
  });

  it('shows the linked parent and children of any record', () => {
    expect(
      kinds(
        input({
          record: { ...input().record, record: ref('p', 'Parent') },
          children: [ref('c', 'Child')],
        }),
      ),
    ).toEqual(['linked']);
  });
});
