import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Markdown from './Markdown.svelte';
import { renderMarkdown } from '$lib/utils/markdown';

describe('renderMarkdown', () => {
  it('renders headings, emphasis, blockquotes, lists, and links', () => {
    const html = renderMarkdown(
      [
        '# Title',
        '',
        'A line with **bold** and *italic* and a [link](https://example.com).',
        '',
        '> Quoted wisdom.',
        '',
        '- one',
        '- two',
      ].join('\n'),
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<a href="https://example.com" rel="noopener noreferrer">link</a>');
    expect(html).toContain('<blockquote>Quoted wisdom.</blockquote>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
  });

  it('keeps single newlines inside a paragraph as hard breaks', () => {
    expect(renderMarkdown('Yours faithfully,\nB. Franklin')).toBe(
      '<p>Yours faithfully,<br />B. Franklin</p>',
    );
  });

  it('is XSS-safe: escapes raw HTML and drops unsafe link schemes', () => {
    const html = renderMarkdown('<script>alert(1)</script> and [x](javascript:alert(1))');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    // Unsafe scheme → rendered as plain text, no anchor.
    expect(html).not.toContain('<a');
    expect(html).toContain('x');
  });

  it('returns empty string for blank input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});

describe('Markdown component', () => {
  it('renders the formatted HTML', async () => {
    const { container } = render(Markdown, { source: '# Hello\n\nworld **bold**' });
    expect(container.querySelector('h1')?.textContent).toBe('Hello');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('shows a placeholder when there is no text', async () => {
    const { container } = render(Markdown, { source: '' });
    expect(container.textContent).toContain('No letter text yet.');
  });
});
