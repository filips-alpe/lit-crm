import { describe, expect, it } from 'vitest';
import { bestPageSections, type BestPageInput } from './bestPage';

const empty: BestPageInput = {
  fields: [],
  references: [],
  variants: [],
  mentions: { items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 },
  sources: [],
  related: [],
  mentionedEntities: [],
  sequence: null,
};

const ref = (id: string, count = 1) => ({ id, title: id, typeCode: 'x', count });

describe('bestPageSections', () => {
  it('returns no sections for a record with no data', () => {
    expect(bestPageSections(empty)).toEqual([]);
  });

  it('omits every empty section and keeps the others in a fixed order', () => {
    const sections = bestPageSections({
      ...empty,
      fields: [{ id: 'note', label: 'Note', kind: 'text', writeTo: 'note', value: 'n' }],
      variants: [{ surface: 'Jeff', count: 2 }],
      related: [ref('a')],
    });
    expect(sections.map((s) => s.kind)).toEqual(['fields', 'variants', 'related']);
  });

  it('orders all sections: fields, references, variants, mentions, sources, related, mentioned, sequence', () => {
    const sections = bestPageSections({
      fields: [{ id: 'f', label: 'F', kind: 'text', writeTo: 'note', value: 'v' }],
      references: ['r'],
      variants: [{ surface: 's', count: 1 }],
      mentions: {
        items: [
          {
            recordId: 'd',
            recordTitle: 'D',
            typeCode: 'doc',
            start: 0,
            end: 1,
            surface: 's',
            before: '',
            after: '',
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      },
      sources: [ref('d')],
      related: [ref('e')],
      mentionedEntities: [ref('g')],
      sequence: { position: 2, total: 3, prev: { id: 'p', title: 'P' }, next: null },
    });
    expect(sections.map((s) => s.kind)).toEqual([
      'fields',
      'references',
      'variants',
      'mentions',
      'sources',
      'related',
      'mentioned',
      'sequence',
    ]);
  });

  it('passes pagination through on the mentions section', () => {
    const [mentions] = bestPageSections({
      ...empty,
      mentions: {
        items: [
          {
            recordId: 'd',
            recordTitle: null,
            typeCode: 'doc',
            start: 5,
            end: 6,
            surface: 'x',
            before: 'a',
            after: 'b',
          },
        ],
        page: 2,
        pageSize: 50,
        total: 51,
        totalPages: 2,
      },
    });
    expect(mentions).toMatchObject({ kind: 'mentions', page: 2, totalPages: 2, total: 51 });
  });

  it('does not repeat the title or the references as fields', () => {
    const sections = bestPageSections({
      ...empty,
      fields: [
        { id: 't', label: 'Name', kind: 'text', writeTo: 'title', value: 'T' },
        { id: 'r', label: 'Sources', kind: 'list', writeTo: 'references', value: ['x'] },
      ],
      references: ['x'],
    });
    expect(sections.map((s) => s.kind)).toEqual(['references']);
  });

  it('omits a sequence with neither neighbour', () => {
    expect(
      bestPageSections({
        ...empty,
        sequence: { position: 1, total: 1, prev: null, next: null },
      }),
    ).toEqual([]);
  });

  it('does not depend on the record id or type: same input gives same output', () => {
    const a = bestPageSections({ ...empty, sources: [ref('x')] });
    const b = bestPageSections({ ...empty, sources: [ref('x')] });
    expect(a).toEqual(b);
  });
});
