import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ListInput from './ListInput.svelte';
import LocationInput from './LocationInput.svelte';

const base = { controlProps: {}, hasError: false, onChange: () => {} };

describe('ListInput accessibility', () => {
  it('names the entry box after the field and each remove button after its item', () => {
    render(ListInput, {
      ...base,
      field: { id: 'a', label: 'Refs', kind: 'list', writeTo: 'references' },
      value: ['alpha', 'beta'],
    });
    expect(document.querySelector('input[aria-label="Refs"]')).not.toBeNull();
    const labels = [...document.querySelectorAll('button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Remove alpha', 'Remove beta']);
  });
});

describe('LocationInput accessibility', () => {
  it('contains no nested label and labels both boxes', () => {
    render(LocationInput, {
      ...base,
      controlProps: { 'aria-invalid': 'true' },
      field: { id: 'a', label: 'Where', kind: 'location', writeTo: 'fromGeo' },
      value: '51.5,-0.1',
    });
    expect(document.querySelectorAll('label').length).toBe(0);
    const inputs = [...document.querySelectorAll('input')];
    expect(inputs.map((i) => i.getAttribute('aria-label'))).toEqual(['Lat', 'Lng']);
    expect(inputs.map((i) => i.getAttribute('aria-invalid'))).toEqual(['true', 'true']);
  });
});
