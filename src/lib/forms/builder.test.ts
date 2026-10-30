import { describe, expect, it } from 'vitest';
import {
  addEmptyField,
  availableColumnsForField,
  canRemoveField,
  columnsForKind,
  duplicateLabels,
  isKindAvailableForField,
  removeField,
  setFieldDefault,
  setFieldKind,
  setFieldRequired,
  updateField,
} from './builder';
import type { FormLayout } from './layout';

describe('addEmptyField', () => {
  it('appends a new field with a generated id, keeping originals untouched', () => {
    const before: FormLayout = { fields: [] };
    const after = addEmptyField(before);
    expect(before.fields.length).toBe(0);
    expect(after.fields.length).toBe(1);
    expect(after.fields[0].id).toMatch(/.+/);
  });

  it('generates a unique id even when called repeatedly', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    const ids = layout.fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('defaults the first added field to the first text column (note)', () => {
    const layout = addEmptyField({ fields: [] });
    expect(layout.fields[0].writeTo).toBe('note');
  });

  it('picks the next unused text column for subsequent adds, never duplicating', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    const writeTos = layout.fields.map((f) => f.writeTo);
    expect(new Set(writeTos).size).toBe(3);
    expect(writeTos[0]).toBe('note');
    expect(writeTos[1]).toBe('title');
    expect(writeTos[2]).toBe('description');
  });

  it('falls through to number/date columns once all text columns are taken', () => {
    let layout: FormLayout = { fields: [] };
    // Burn through every text column
    for (let i = 0; i < columnsForKind('text').length; i++) {
      layout = addEmptyField(layout);
    }
    layout = addEmptyField(layout); // one more — must NOT collide with 'note'
    const writeTos = layout.fields.map((f) => f.writeTo);
    expect(new Set(writeTos).size).toBe(writeTos.length); // all unique
    const overflow = layout.fields[layout.fields.length - 1];
    expect(overflow.writeTo).toBe('sum');
    expect(overflow.kind).toBe('number');
  });

  it('gives each newly added field a unique label', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    const labels = layout.fields.map((f) => f.label);
    expect(new Set(labels).size).toBe(3);
  });

  it('still picks a unique label when the user has renamed earlier fields', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout);
    layout = updateField(layout, layout.fields[0].id, { label: 'New field 2' });
    layout = addEmptyField(layout);
    const labels = layout.fields.map((f) => f.label);
    expect(new Set(labels).size).toBe(2);
  });

  it('returns the original layout unchanged when every column is taken', () => {
    let layout: FormLayout = { fields: [] };
    const totalColumns =
      columnsForKind('text').length +
      columnsForKind('number').length +
      columnsForKind('date').length +
      columnsForKind('list').length;
    for (let i = 0; i < totalColumns; i++) {
      layout = addEmptyField(layout);
    }
    const before = layout;
    const after = addEmptyField(before);
    expect(after).toBe(before);
  });
});

describe('duplicateLabels', () => {
  it('returns an empty set when all labels are unique', () => {
    const layout: FormLayout = {
      fields: [
        { id: 'a', label: 'Alpha', kind: 'text', writeTo: 'note' },
        { id: 'b', label: 'Beta', kind: 'text', writeTo: 'title' },
      ],
    };
    expect(duplicateLabels(layout).size).toBe(0);
  });

  it('reports the offending label when two fields share one', () => {
    const layout: FormLayout = {
      fields: [
        { id: 'a', label: 'Same', kind: 'text', writeTo: 'note' },
        { id: 'b', label: 'Same', kind: 'text', writeTo: 'title' },
        { id: 'c', label: 'Different', kind: 'text', writeTo: 'title' },
      ],
    };
    const dups = duplicateLabels(layout);
    expect(dups.has('Same')).toBe(true);
    expect(dups.has('Different')).toBe(false);
  });

  it('ignores empty labels (those have their own required-field validation)', () => {
    const layout: FormLayout = {
      fields: [
        { id: 'a', label: '', kind: 'text', writeTo: 'note' },
        { id: 'b', label: '', kind: 'text', writeTo: 'idNote' },
      ],
    };
    expect(duplicateLabels(layout).size).toBe(0);
  });
});

describe('updateField', () => {
  it('patches the named field and leaves others alone', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    const [a, b] = layout.fields;
    const next = updateField(layout, a.id, { label: 'Renamed' });
    expect(next.fields[0].label).toBe('Renamed');
    expect(next.fields[1]).toEqual(b);
  });

  it('returns the layout unchanged when the id is not found', () => {
    const layout = addEmptyField({ fields: [] });
    const next = updateField(layout, 'ghost', { label: 'x' });
    expect(next).toEqual(layout);
  });

  it('does not mutate the original layout', () => {
    const layout = addEmptyField({ fields: [] });
    const original = JSON.parse(JSON.stringify(layout));
    updateField(layout, layout.fields[0].id, { label: 'new' });
    expect(layout).toEqual(original);
  });
});

describe('availableColumnsForField', () => {
  it('returns all kind-appropriate columns when the layout has only one field', () => {
    const layout = addEmptyField({ fields: [] });
    const id = layout.fields[0].id;
    expect(availableColumnsForField(layout, id, 'text')).toEqual(columnsForKind('text'));
  });

  it('excludes columns used by OTHER fields but keeps the current field’s own writeTo', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout); // writeTo='note'
    layout = addEmptyField(layout); // writeTo='title'
    const [a, b] = layout.fields;
    const optionsForA = availableColumnsForField(layout, a.id, 'text');
    expect(optionsForA).toContain('note'); // a's own value stays
    expect(optionsForA).not.toContain('title'); // b's value is gone
    const optionsForB = availableColumnsForField(layout, b.id, 'text');
    expect(optionsForB).toContain('title');
    expect(optionsForB).not.toContain('note');
  });

  it('only filters within the same kind family', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout); // text, note
    const numId = 'x';
    layout = {
      fields: [...layout.fields, { id: numId, label: 'N', kind: 'number', writeTo: 'sum' }],
    };
    // Filtering for a third text field — number's `sum` doesn't shrink the text list
    const newTextId = 'y';
    const synthetic: FormLayout = {
      fields: [...layout.fields, { id: newTextId, label: 'T', kind: 'text', writeTo: 'title' }],
    };
    const opts = availableColumnsForField(synthetic, newTextId, 'text');
    expect(opts).not.toContain('note'); // used by another text field
    expect(opts).toContain('title'); // own value
    expect(opts).toContain('description'); // still free
  });
});

describe('isKindAvailableForField', () => {
  it('reports list available for the sole text field in a fresh layout', () => {
    const layout = addEmptyField({ fields: [] });
    const id = layout.fields[0].id;
    expect(isKindAvailableForField(layout, id, 'list')).toBe(true);
  });

  it('reports list NOT available for a text field when another field already has kind=list', () => {
    const layout: FormLayout = {
      fields: [
        { id: 'a', label: 'Refs', kind: 'list', writeTo: 'references' },
        { id: 'b', label: 'Note', kind: 'text', writeTo: 'note' },
      ],
    };
    expect(isKindAvailableForField(layout, 'b', 'list')).toBe(false);
  });

  it('still reports list available for the field that currently has kind=list', () => {
    const layout: FormLayout = {
      fields: [
        { id: 'a', label: 'Refs', kind: 'list', writeTo: 'references' },
        { id: 'b', label: 'Note', kind: 'text', writeTo: 'note' },
      ],
    };
    expect(isKindAvailableForField(layout, 'a', 'list')).toBe(true);
  });

  it('keeps text/number/date available in a typical layout', () => {
    const layout: FormLayout = {
      fields: [
        { id: 'a', label: 'Refs', kind: 'list', writeTo: 'references' },
        { id: 'b', label: 'Note', kind: 'text', writeTo: 'note' },
      ],
    };
    expect(isKindAvailableForField(layout, 'b', 'text')).toBe(true);
    expect(isKindAvailableForField(layout, 'b', 'number')).toBe(true);
    expect(isKindAvailableForField(layout, 'b', 'date')).toBe(true);
  });
});

describe('setFieldKind', () => {
  it('resets writeTo to the first valid column when the new kind is incompatible', () => {
    const layout = addEmptyField({ fields: [] }); // text + writeTo='note'
    const id = layout.fields[0].id;
    const next = setFieldKind(layout, id, 'number');
    expect(next.fields[0].kind).toBe('number');
    expect(next.fields[0].writeTo).toBe('sum');
  });

  it('keeps writeTo when it is still valid for the new kind', () => {
    let layout = addEmptyField({ fields: [] });
    const id = layout.fields[0].id;
    layout = updateField(layout, id, { writeTo: 'from' }); // still text
    const next = setFieldKind(layout, id, 'text');
    expect(next.fields[0].writeTo).toBe('from');
  });

  it('picks the next available column when the first one is taken by another field', () => {
    let layout: FormLayout = {
      fields: [{ id: 'taken', label: 'taken', kind: 'number', writeTo: 'sum' }],
    };
    layout = addEmptyField(layout); // a text field with writeTo='note'
    const newId = layout.fields[1].id;
    const next = setFieldKind(layout, newId, 'number');
    expect(next.fields[1].writeTo).toBe('hours'); // 'sum' is taken, fall through
  });
});

describe('removeField', () => {
  it('drops the field with the matching id', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    const [a, b] = layout.fields;
    const next = removeField(layout, a.id);
    expect(next.fields.map((f) => f.id)).toEqual([b.id]);
  });

  it('returns the same reference when the id is not found', () => {
    const layout = addEmptyField({ fields: [] });
    expect(removeField(layout, 'ghost')).toBe(layout);
  });

  it('refuses to remove the last remaining field', () => {
    const layout = addEmptyField({ fields: [] });
    const id = layout.fields[0].id;
    expect(removeField(layout, id)).toBe(layout);
  });
});

describe('canRemoveField', () => {
  it('is false when only one field is present', () => {
    const layout = addEmptyField({ fields: [] });
    expect(canRemoveField(layout)).toBe(false);
  });

  it('is true once a second field exists', () => {
    let layout: FormLayout = { fields: [] };
    layout = addEmptyField(layout);
    layout = addEmptyField(layout);
    expect(canRemoveField(layout)).toBe(true);
  });
});

describe('setFieldRequired / setFieldDefault', () => {
  const base: FormLayout = {
    fields: [
      { id: 'a', label: 'A', kind: 'text', writeTo: 'note' },
      { id: 'b', label: 'B', kind: 'number', writeTo: 'sum' },
    ],
  };

  it('sets and clears required without touching other fields', () => {
    const on = setFieldRequired(base, 'a', true);
    expect(on.fields[0].required).toBe(true);
    expect(on.fields[1]).toBe(base.fields[1]);
    const off = setFieldRequired(on, 'a', false);
    expect('required' in off.fields[0]).toBe(false);
  });

  it('sets a default and removes the key when cleared', () => {
    const withDefault = setFieldDefault(base, 'b', 5);
    expect(withDefault.fields[1].defaultValue).toBe(5);
    const cleared = setFieldDefault(withDefault, 'b', undefined);
    expect('defaultValue' in cleared.fields[1]).toBe(false);
  });

  it('leaves the layout alone for an unknown id', () => {
    expect(setFieldRequired(base, 'zzz', true)).toBe(base);
    expect(setFieldDefault(base, 'zzz', 1)).toBe(base);
  });

  it('drops a default that no longer fits when the kind changes, keeps one that does', () => {
    const withText = setFieldDefault(base, 'a', 'hello');
    // text -> number: 'hello' is not a number.
    expect('defaultValue' in setFieldKind(withText, 'a', 'number').fields[0]).toBe(false);
    // text -> markdown: still a string.
    expect(setFieldKind(withText, 'a', 'markdown').fields[0].defaultValue).toBe('hello');
    // any kind -> relation: no defaults for relations.
    expect('defaultValue' in setFieldKind(withText, 'a', 'user').fields[0]).toBe(false);
  });
});
