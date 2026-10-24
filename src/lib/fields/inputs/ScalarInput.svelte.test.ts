import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScalarInput from './ScalarInput.svelte';

const noop = () => {};

describe('ScalarInput date formatting', () => {
  it('formats a seeded Date into a YYYY-MM-DD value for date inputs', async () => {
    render(ScalarInput, {
      field: { id: 'a', label: 'A', kind: 'date', writeTo: 'date' },
      value: new Date('2026-03-04T00:00:00Z'),
      controlProps: {},
      hasError: false,
      onChange: noop,
    });
    const el = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(el.value).toBe('2026-03-04');
  });

  it('formats a seeded Date into a YYYY-MM-DDTHH:mm value for datetime inputs', async () => {
    render(ScalarInput, {
      field: { id: 'a', label: 'A', kind: 'datetime', writeTo: 'start' },
      value: new Date('2026-03-04T09:30:00Z'),
      controlProps: {},
      hasError: false,
      onChange: noop,
    });
    const el = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    expect(el.value).toBe('2026-03-04T09:30');
  });

  it('renders text values unchanged', async () => {
    render(ScalarInput, {
      field: { id: 'a', label: 'A', kind: 'text', writeTo: 'title' },
      value: 'Hello',
      controlProps: {},
      hasError: false,
      onChange: noop,
    });
    const el = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(el.value).toBe('Hello');
  });
});

describe('ScalarInput clearing', () => {
  it.each(['date', 'datetime'] as const)(
    'reports a cleared %s input as undefined',
    async (kind) => {
      const onChange = vi.fn();
      render(ScalarInput, {
        field: { id: 'a', label: 'A', kind, writeTo: 'date' },
        value: undefined,
        controlProps: {},
        hasError: false,
        onChange,
      });
      const el = document.querySelector('input') as HTMLInputElement;
      el.value = kind === 'date' ? '2026-03-04' : '2026-03-04T09:30';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      expect(onChange).toHaveBeenLastCalledWith(undefined);
    },
  );
});

describe('ScalarInput datetime entry', () => {
  it('reports the typed wall-clock as a UTC instant string', async () => {
    const onChange = vi.fn();
    render(ScalarInput, {
      field: { id: 'a', label: 'A', kind: 'datetime', writeTo: 'start' },
      value: undefined,
      controlProps: {},
      hasError: false,
      onChange,
    });
    const el = document.querySelector('input') as HTMLInputElement;
    el.value = '2026-03-04T09:30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('2026-03-04T09:30Z');
  });
});
