/**
 * A tiny, dependency-free Markdown→HTML renderer for letter bodies. It is
 * XSS-safe *by construction*: the source is HTML-escaped first, so the only tags
 * in the output are the ones this function emits — no raw HTML in the source can
 * survive. It covers the common subset (headings, emphasis, links, lists,
 * blockquotes, rules, inline code), which is enough to show a letter nicely.
 *
 * Pure and DOM-free so it runs on the server and is unit-testable.
 */

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

// Only link to schemes that cannot execute script. The url here is already
// HTML-escaped, so it can carry no quote to break out of the attribute. A
// protocol-relative `//host` would look internal but leave the site, so only a
// single leading `/` is a local path. Browsers read `\` as `/`, so `/\host`
// is the same escape.
function safeHref(url: string): string | null {
  return /^(https?:\/\/|mailto:|\/(?![/\\]))/i.test(url) ? url : null;
}

/** Emphasis markers only; code and links are already placeholders by now. */
function emphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|\W)_(.+?)_(?!\w)/g, '$1<em>$2</em>');
}

// Finished code spans and links are swapped for placeholders so the emphasis
// pass can't reach into a URL or a code span. The delimiter is a private-use
// char that renderMarkdown strips from the source, so it can't be spoofed.
const TOKEN = /\uE000(\d+)\uE000/g;

/** Inline spans, applied to text that has already been HTML-escaped. */
function inline(text: string): string {
  const tokens: string[] = [];
  const stash = (html: string) => `\uE000${tokens.push(html) - 1}\uE000`;

  const withCode = text.replace(/`([^`]+)`/g, (_m, code: string) => stash(`<code>${code}</code>`));
  const withLinks = withCode.replace(
    // [label](url) — dropped to plain label when the scheme isn't allowed.
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, url: string) => {
      const href = safeHref(url);
      return href
        ? stash(`<a href="${href}" rel="noopener noreferrer">${emphasis(label)}</a>`)
        : label;
    },
  );

  let out = emphasis(withLinks);
  // Links can hold code placeholders in their label, so restore until stable.
  while (/\uE000\d+\uE000/.test(out))
    out = out.replace(TOKEN, (_m, n: string) => tokens[Number(n)]);
  return out;
}

/** Render a Markdown string to a safe HTML string. */
export function renderMarkdown(src: string | null | undefined): string {
  if (typeof src !== 'string' || src.trim() === '') return '';

  const lines = escapeHtml(src.replace(/\uE000/g, '').replace(/\r\n?/g, '\n')).split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let i = 0;

  // A paragraph keeps its internal single newlines as hard breaks, so a
  // salutation or signature block stays on its own lines.
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join('<br />')}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      flushPara();
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara();
      out.push('<hr />');
      i++;
      continue;
    }

    // Blockquote: `>` became `&gt;` in escaping.
    if (/^&gt;\s?/.test(trimmed)) {
      flushPara();
      const buf: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^&gt;\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${buf.map(inline).join('<br />')}</blockquote>`);
      continue;
    }

    const list = /^[-*]\s+/.test(trimmed)
      ? { tag: 'ul', marker: /^[-*]\s+/ }
      : /^\d+\.\s+/.test(trimmed)
        ? { tag: 'ol', marker: /^\d+\.\s+/ }
        : null;
    if (list) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && list.marker.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(list.marker, ''))}</li>`);
        i++;
      }
      out.push(`<${list.tag}>${items.join('')}</${list.tag}>`);
      continue;
    }

    para.push(trimmed);
    i++;
  }
  flushPara();

  return out.join('\n');
}
