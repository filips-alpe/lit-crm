import { describe, expect, it } from 'vitest';
import { buildRendererProps } from './props';
import type { FormLayout } from '$lib/forms/layout';

const layout: FormLayout = {
  fields: [
    { id: 'who', label: 'Who', kind: 'text', writeTo: 'title' },
    { id: 'amount', label: 'Amount', kind: 'number', writeTo: 'sum' },
    { id: 'refs', label: 'Sources', kind: 'list', writeTo: 'references' },
  ],
};

const type = { code: 'inv', color: '#abcdef', iconSeed: 'star', layout };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    createdAt: '2026-01-02T00:00:00.000Z',
    status: 'ACTIVE',
    title: 'Acme',
    sum: 1200,
    references: ['a', 'b'],
    ...overrides,
  };
}

describe('buildRendererProps', () => {
  it('keys each configured field by its id with label, kind, writeTo, formatted value and raw', () => {
    const props = buildRendererProps(row(), type);
    expect(props.fields.who).toEqual({
      label: 'Who',
      kind: 'text',
      writeTo: 'title',
      value: 'Acme',
      raw: 'Acme',
    });
    expect(props.fields.refs.value).toEqual(['a', 'b']);
    expect(props.fields.refs.raw).toEqual(['a', 'b']);
    // Numbers are formatted for display but keep the numeric raw value.
    expect(typeof props.fields.amount.value).toBe('string');
    expect(props.fields.amount.raw).toBe(1200);
    // writeTo lets renderers target a field semantically.
    expect(props.fields.amount.writeTo).toBe('sum');
    expect(props.fields.refs.writeTo).toBe('references');
  });

  it('exposes only configured fields, never arbitrary record columns', () => {
    const props = buildRendererProps(row({ note: 'secret' }), type);
    expect(Object.keys(props.fields).sort()).toEqual(['amount', 'refs', 'who']);
  });

  it('always exposes the non-form allowlist, with creator null when absent', () => {
    const props = buildRendererProps(row(), type);
    expect(props.status).toBe('ACTIVE');
    expect(props.createdAt).toBe('2026-01-02T00:00:00.000Z');
    expect(props.type).toEqual({ code: 'inv', color: '#abcdef', iconSeed: 'star' });
    expect(props.creator).toBeNull();
  });

  it('passes the creator through when present', () => {
    const creator = { username: 'al', name: 'Al', color: '#111', avatarSeed: null };
    const props = buildRendererProps(row({ creator }), type);
    expect(props.creator).toEqual(creator);
  });

  it('tolerates a null layout (no fields)', () => {
    const props = buildRendererProps(row(), { ...type, layout: null });
    expect(props.fields).toEqual({});
  });

  it('exposes the record’s project membership as id/code/color chips', () => {
    const props = buildRendererProps(
      row({
        projects: [
          { projectId: 'p1', project: { id: 'p1', code: 'Alpha', color: '#111111' } },
          { projectId: 'p2', project: { id: 'p2', code: 'Beta', color: '#222222' } },
        ],
      }),
      type,
    );
    expect(props.projects).toEqual([
      { id: 'p1', code: 'Alpha', color: '#111111' },
      { id: 'p2', code: 'Beta', color: '#222222' },
    ]);
  });

  it('defaults projects to an empty array when absent', () => {
    expect(buildRendererProps(row(), type).projects).toEqual([]);
  });

  it('resolves user/record relation fields to a labelled relation from the joined entity', () => {
    const relLayout: FormLayout = {
      fields: [
        { id: 'author', label: 'Author', kind: 'user', writeTo: 'creatorId' },
        { id: 'owner', label: 'Owner', kind: 'user', writeTo: 'assigneeId' },
        { id: 'reply', label: 'Replies to', kind: 'record', writeTo: 'recordId' },
      ],
    };
    const props = buildRendererProps(
      row({
        creatorId: 'u1',
        assigneeId: 'u2',
        recordId: 'rec9',
        creator: { id: 'u1', username: 'al', name: 'Al', color: '#111', avatarSeed: 'seedA' },
        assignee: { id: 'u2', username: 'bo', name: 'Bo', color: '#222', avatarSeed: null },
        record: { id: 'rec9', title: 'Earlier letter', note: null },
      }),
      { ...type, layout: relLayout },
    );

    expect(props.fields.author.value).toBe('Al');
    expect(props.fields.author.relation).toEqual({
      id: 'u1',
      label: 'Al',
      color: '#111',
      avatarSeed: 'seedA',
    });
    expect(props.fields.owner.relation).toMatchObject({ id: 'u2', label: 'Bo' });
    expect(props.fields.reply.value).toBe('Earlier letter');
    expect(props.fields.reply.relation).toEqual({ id: 'rec9', label: 'Earlier letter' });
  });

  it('leaves a relation field empty when the entity is absent (e.g. the live preview)', () => {
    const relLayout: FormLayout = {
      fields: [{ id: 'author', label: 'Author', kind: 'user', writeTo: 'creatorId' }],
    };
    const props = buildRendererProps(row({ creatorId: 'u1' }), { ...type, layout: relLayout });
    expect(props.fields.author.value).toBeNull();
    expect(props.fields.author.relation).toBeNull();
  });
});
