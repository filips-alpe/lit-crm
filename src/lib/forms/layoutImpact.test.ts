import { describe, expect, it } from 'vitest';
import { layoutImpacts } from './layoutImpact';
import type { FormLayout } from './layout';

const saved: FormLayout = {
  fields: [
    { id: 'a', label: 'Memo', kind: 'text', writeTo: 'note' },
    { id: 'b', label: 'Amount', kind: 'number', writeTo: 'sum' },
    { id: 'c', label: 'Empty', kind: 'text', writeTo: 'title' },
  ],
};
const counts = { note: 3, sum: 2, title: 0 };

describe('layoutImpacts', () => {
  it('reports nothing for an unchanged layout', () => {
    expect(layoutImpacts(saved, saved, counts)).toEqual([]);
  });

  it('reports a removed field that holds data, with the record count', () => {
    const next = { fields: saved.fields.filter((f) => f.id !== 'a') };
    expect(layoutImpacts(saved, next, counts)).toEqual([
      { fieldId: 'a', label: 'Memo', reason: 'removed', column: 'note', count: 3 },
    ]);
  });

  it('ignores fields whose column holds no data', () => {
    const next = { fields: saved.fields.filter((f) => f.id !== 'c') };
    expect(layoutImpacts(saved, next, counts)).toEqual([]);
  });

  it('reports a kind change that moves the field to another column', () => {
    const next: FormLayout = {
      fields: saved.fields.map((f) =>
        f.id === 'a' ? { ...f, kind: 'number' as const, writeTo: 'hours' } : f,
      ),
    };
    expect(layoutImpacts(saved, next, counts)).toMatchObject([
      { fieldId: 'a', reason: 'kind', column: 'note', count: 3 },
    ]);
  });

  it('reports a column change without a kind change', () => {
    const next: FormLayout = {
      fields: saved.fields.map((f) => (f.id === 'a' ? { ...f, writeTo: 'description' } : f)),
    };
    expect(layoutImpacts(saved, next, counts)).toMatchObject([{ fieldId: 'a', reason: 'column' }]);
  });

  it('stays quiet when the kind changes but the column keeps its data visible', () => {
    const next: FormLayout = {
      fields: saved.fields.map((f) => (f.id === 'a' ? { ...f, kind: 'markdown' as const } : f)),
    };
    expect(layoutImpacts(saved, next, counts)).toEqual([]);
  });

  it('stays quiet when another field takes over the freed column', () => {
    const next: FormLayout = {
      fields: [
        { id: 'a', label: 'Memo', kind: 'text', writeTo: 'description' },
        { id: 'z', label: 'New', kind: 'text', writeTo: 'note' },
        saved.fields[1],
      ],
    };
    expect(layoutImpacts(saved, next, counts)).toEqual([]);
  });
});
