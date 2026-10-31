import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import AnnotatedText from './AnnotatedText.svelte';

const text = 'Dear Madison,\n\n  I write from Paris;   Madison’s reply  awaits.\nJefferson';
const at = (s: string, from = 0) => {
  const start = text.indexOf(s, from);
  return { start, end: start + s.length, surface: s };
};
const mentions = [
  { entityId: 'e-mad', ...at('Madison') },
  { entityId: 'e-par', ...at('Paris') },
  { entityId: 'e-mad', ...at('Madison', 20) },
  { entityId: 'e-jef', ...at('Jefferson') },
];

describe('AnnotatedText', () => {
  it('keeps the text exactly: textContent equals text, whitespace included', async () => {
    const { container } = render(AnnotatedText, { text, mentions });
    const root = container.querySelector('.annotated-text')!;
    expect(root.textContent).toBe(text);
    expect(getComputedStyle(root).whiteSpace).toBe('pre-wrap');
  });

  it('turns each mention into a link to its entity page, wording unchanged', async () => {
    render(AnnotatedText, { text, mentions });
    const links = page.getByRole('link');
    await expect.element(links.first()).toHaveTextContent('Madison');
    const hrefs = Array.from(document.querySelectorAll('.annotated-text a')).map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(hrefs).toEqual([
      ['Madison', '/entity/e-mad'],
      ['Paris', '/entity/e-par'],
      ['Madison', '/entity/e-mad'],
      ['Jefferson', '/entity/e-jef'],
    ]);
  });

  it('shows plain text with no links when nothing is mentioned or a mention is stale', async () => {
    const { container } = render(AnnotatedText, {
      text,
      mentions: [{ entityId: 'x', start: 5, end: 12, surface: 'Madisom' }],
    });
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelector('.annotated-text')!.textContent).toBe(text);
  });

  it('does not interpret markdown or HTML in the text', async () => {
    const raw = '# not a heading *or bold* <b>x</b>';
    const { container } = render(AnnotatedText, { text: raw });
    const root = container.querySelector('.annotated-text')!;
    expect(root.textContent).toBe(raw);
    expect(root.querySelector('h1, em, b')).toBeNull();
  });
});
