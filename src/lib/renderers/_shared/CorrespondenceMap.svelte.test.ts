import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CorrespondenceMap from './CorrespondenceMap.svelte';

const routes = [
  {
    id: 'other',
    from: { lat: 48.85, lng: 2.35 },
    to: { lat: 40, lng: -75 },
    label: 'Voltaire → Franklin',
  },
  // Current is appended last, the way the detail builds it.
  {
    id: 'cur',
    from: { lat: 51.5, lng: -0.1 },
    to: { lat: 40, lng: -75 },
    label: 'Franklin → Collinson',
  },
];

describe('CorrespondenceMap', () => {
  it('draws the map and links non-current letters in page mode', async () => {
    render(CorrespondenceMap, { letters: routes, currentId: 'cur' });

    expect(document.querySelector('svg')).not.toBeNull();
    // A sibling letter is a link to its page…
    const link = document.querySelector('a[aria-label="Open letter: Voltaire → Franklin"]');
    expect(link?.getAttribute('href')).toBe('/data/other');
    // …and the current letter is inert — not a link.
    expect(document.querySelector('a[aria-label="Open letter: Franklin → Collinson"]')).toBeNull();
  });

  it('calls onSelect instead of linking when provided (modal mode)', async () => {
    const onSelect = vi.fn();
    render(CorrespondenceMap, { letters: routes, currentId: 'cur', onSelect });

    expect(document.querySelector('a')).toBeNull();
    // The clickable path is a focusable SVG <g role="button">. Dispatch the click
    // on the element itself — a curved arc has no fill, so a positional click at
    // its bbox centre would land on the sea behind it.
    const path = document.querySelector(
      'g[role="button"][aria-label="Open letter: Voltaire → Franklin"]',
    );
    expect(path).not.toBeNull();
    path?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('other');
  });
});
