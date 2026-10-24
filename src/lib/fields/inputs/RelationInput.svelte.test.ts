import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RelationInput from './RelationInput.svelte';
import { recordOptionsContext, type RecordFormOptions } from '$lib/forms/recordOptions';

const OPTIONS: RecordFormOptions = {
  users: [
    { id: 'u1', name: 'Ada Lovelace', username: 'ada', color: '#000000', avatarSeed: null },
    { id: 'u2', name: 'Alan Turing', username: 'alan', color: '#000000', avatarSeed: null },
  ],
  records: [{ id: 'r1', label: 'Prior letter' }],
  projects: [],
};

function renderRelation(props: {
  field: { id: string; label: string; kind: 'user' | 'record'; writeTo: string };
  value?: unknown;
  onChange?: (v: unknown) => void;
}) {
  return render(RelationInput, {
    props: {
      field: props.field,
      value: props.value,
      controlProps: {},
      hasError: false,
      onChange: props.onChange ?? (() => {}),
    },
    context: recordOptionsContext(OPTIONS),
  });
}

describe('RelationInput', () => {
  it('lists the user options for a user field', () => {
    renderRelation({ field: { id: 'a', label: 'Author', kind: 'user', writeTo: 'creatorId' } });
    const select = document.querySelector('select') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['—', 'Ada Lovelace', 'Alan Turing']);
  });

  it('lists the record options for a record field', () => {
    renderRelation({
      field: { id: 'a', label: 'Replies to', kind: 'record', writeTo: 'recordId' },
    });
    const select = document.querySelector('select') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['', 'r1']);
  });

  it('shows the current value as the selected option', () => {
    renderRelation({
      field: { id: 'a', label: 'Author', kind: 'user', writeTo: 'creatorId' },
      value: 'u2',
    });
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('u2');
  });

  it('emits the selected id on change, and undefined when cleared', async () => {
    const onChange = vi.fn();
    renderRelation({
      field: { id: 'a', label: 'Author', kind: 'user', writeTo: 'creatorId' },
      onChange,
    });
    const select = document.querySelector('select') as HTMLSelectElement;
    select.value = 'u1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('u1');

    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
