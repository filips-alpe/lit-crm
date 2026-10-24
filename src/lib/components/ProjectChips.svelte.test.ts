import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectChips from './ProjectChips.svelte';

describe('ProjectChips', () => {
  it('renders a chip per project with its code', () => {
    render(ProjectChips, {
      projects: [
        { id: 'p1', code: 'Alpha', color: '#111111' },
        { id: 'p2', code: 'Beta', color: '#222222' },
      ],
    });
    const chips = Array.from(document.querySelectorAll('span[title]'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['Alpha', 'Beta']);
    expect((chips[0] as HTMLElement).style.backgroundColor).toBe('rgb(17, 17, 17)');
  });

  it('picks readable text for light and dark user colours', () => {
    render(ProjectChips, {
      projects: [
        { id: 'p1', code: 'Dark', color: '#1e3a8a' },
        { id: 'p2', code: 'Light', color: '#fde047' },
      ],
    });
    const [dark, light] = Array.from(document.querySelectorAll<HTMLElement>('span[title]'));
    expect(dark.style.color).toBe('rgb(255, 255, 255)');
    expect(light.style.color).toBe('rgb(28, 25, 23)');
  });

  it('renders nothing when there are no projects', () => {
    render(ProjectChips, { projects: [] });
    expect(document.querySelector('span[title]')).toBeNull();
  });
});
