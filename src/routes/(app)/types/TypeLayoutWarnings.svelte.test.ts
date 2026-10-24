import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TypeLayoutWarnings from './TypeLayoutWarnings.svelte';
import type { FormLayout } from '$lib/forms/layout';

const saved: FormLayout = {
  fields: [
    { id: 'a', label: 'Memo', kind: 'text', writeTo: 'note' },
    { id: 'b', label: 'Amount', kind: 'number', writeTo: 'sum' },
  ],
};

describe('TypeLayoutWarnings', () => {
  it('renders nothing while the layout still shows all existing data', () => {
    render(TypeLayoutWarnings, { saved, layout: saved, counts: { note: 4 } });
    expect(document.querySelector('[role=alert]')).toBeNull();
  });

  it('warns with the affected record count when a field with data is removed', () => {
    render(TypeLayoutWarnings, {
      saved,
      layout: { fields: [saved.fields[1]] },
      counts: { note: 4, sum: 0 },
    });
    const alert = document.querySelector('[role=alert]');
    expect(alert?.textContent).toContain('Memo');
    expect(alert?.textContent).toContain('4');
  });

  it('warns once per field for a kind change that moves the column', () => {
    render(TypeLayoutWarnings, {
      saved,
      layout: {
        fields: [{ ...saved.fields[0], kind: 'number', writeTo: 'hours' }, saved.fields[1]],
      },
      counts: { note: 2 },
    });
    expect(document.querySelectorAll('[role=alert] li')).toHaveLength(1);
  });
});
