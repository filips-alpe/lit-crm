/** Debounce before a typed query hits `/data/options`. */
export const SEARCH_DEBOUNCE_MS = 200;

export interface SearchRequest {
  kind: 'user' | 'record';
  q: string;
  /** A record id the endpoint must leave out (the record being edited). */
  excludeId?: string;
}

/** The `/data/options` URL for a search request. */
export function optionsUrl({ kind, q, excludeId }: SearchRequest): string {
  const params = new URLSearchParams({ kind, q });
  if (kind === 'record' && excludeId) params.set('exclude', excludeId);
  return `/data/options?${params}`;
}

/** Run a search; resolves to the raw option rows, rejects on any non-OK answer. */
export async function searchOptions<T>(
  request: SearchRequest,
  init: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<T[]> {
  const res = await (init.fetch ?? fetch)(optionsUrl(request), { signal: init.signal });
  if (!res.ok) throw new Error(`options search failed: ${res.status}`);
  const body = (await res.json()) as { options?: T[] };
  return body.options ?? [];
}

/** Next highlighted index for a keyboard press in an option list, or `null` when
 *  the key does not move the highlight. `-1` means nothing is highlighted. */
export function moveActive(current: number, key: string, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowDown':
      return current < 0 || current >= count - 1 ? 0 : current + 1;
    case 'ArrowUp':
      return current <= 0 ? count - 1 : current - 1;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
