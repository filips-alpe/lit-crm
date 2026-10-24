import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('returns empty for blank input', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown('  ')).toBe('');
  });

  it('escapes raw HTML', () => {
    expect(renderMarkdown('<script>x</script>')).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
  });

  it('renders emphasis, headings, lists and quotes', () => {
    expect(renderMarkdown('**a** *b* _c_')).toBe('<p><strong>a</strong> <em>b</em> <em>c</em></p>');
    expect(renderMarkdown('## Hi')).toBe('<h2>Hi</h2>');
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('> q')).toBe('<blockquote>q</blockquote>');
  });

  it('leaves underscores inside link hrefs alone', () => {
    expect(renderMarkdown('[a](https://x.com/a_b_c)')).toBe(
      '<p><a href="https://x.com/a_b_c" rel="noopener noreferrer">a</a></p>',
    );
  });

  it('leaves emphasis markers inside code spans literal', () => {
    expect(renderMarkdown('`snake_case_x` and `*a*`')).toBe(
      '<p><code>snake_case_x</code> and <code>*a*</code></p>',
    );
  });

  it('does not treat intra-word underscores as emphasis', () => {
    expect(renderMarkdown('snake_case_name')).toBe('<p>snake_case_name</p>');
  });

  it('applies emphasis and code inside a link label', () => {
    expect(renderMarkdown('[**b** `c_d`](/x)')).toBe(
      '<p><a href="/x" rel="noopener noreferrer"><strong>b</strong> <code>c_d</code></a></p>',
    );
  });

  it('allows https, mailto and local paths', () => {
    expect(renderMarkdown('[a](mailto:x@y.z)')).toContain('href="mailto:x@y.z"');
    expect(renderMarkdown('[a](/records/1)')).toContain('href="/records/1"');
  });

  it('drops unsafe and protocol-relative hrefs to the plain label', () => {
    expect(renderMarkdown('[a](javascript:alert)')).toBe('<p>a</p>');
    expect(renderMarkdown('[b](//evil.com)')).toBe('<p>b</p>');
    expect(renderMarkdown('[b](/\\evil.com)')).toBe('<p>b</p>');
    expect(renderMarkdown('[b](\\/evil.com)')).toBe('<p>b</p>');
  });

  it('cannot be spoofed with the placeholder character', () => {
    expect(renderMarkdown('0')).toBe('<p>0</p>');
  });
});
