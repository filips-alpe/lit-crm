import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MarkdownInput from './MarkdownInput.svelte';

describe('MarkdownInput', () => {
  it('renders the source in a textarea and reports edits', async () => {
    const onChange = vi.fn();
    render(MarkdownInput, {
      field: { id: 'b', label: 'Letter', kind: 'markdown', writeTo: 'text' },
      value: '# Hello',
      controlProps: {},
      hasError: false,
      onChange,
    });

    const el = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(el).not.toBeNull();
    expect(el.value).toBe('# Hello');

    el.value = '# Hi there';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('# Hi there');
  });

  it('shows an empty textarea for a null value', async () => {
    render(MarkdownInput, {
      field: { id: 'b', label: 'Letter', kind: 'markdown', writeTo: 'text' },
      value: null,
      controlProps: {},
      hasError: false,
      onChange: () => {},
    });
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
  });
});
