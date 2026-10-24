import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectMultiselect from './ProjectMultiselect.svelte';
import { recordOptionsContext, type RecordFormOptions } from '$lib/forms/recordOptions';

const OPTIONS: RecordFormOptions = {
  users: [],
  records: [],
  projects: [
    { id: 'p1', code: 'Alpha', color: '#111111' },
    { id: 'p2', code: 'Beta', color: '#222222' },
  ],
};

function renderMultiselect(selected: string[], onChange = () => {}) {
  return render(ProjectMultiselect, {
    props: { selected, onChange },
    context: recordOptionsContext(OPTIONS),
  });
}

describe('ProjectMultiselect', () => {
  it('renders a chip per project, marking the selected ones pressed', () => {
    renderMultiselect(['p1']);
    const chips = Array.from(document.querySelectorAll('button'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['Alpha', 'Beta']);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    expect(chips[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('adds a project to the selection when an unselected chip is clicked', () => {
    const onChange = vi.fn();
    renderMultiselect(['p1'], onChange);
    const beta = Array.from(document.querySelectorAll('button')).find(
      (c) => c.textContent?.trim() === 'Beta',
    )!;
    beta.click();
    expect(onChange).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('removes a project when a selected chip is clicked', () => {
    const onChange = vi.fn();
    renderMultiselect(['p1', 'p2'], onChange);
    const alpha = Array.from(document.querySelectorAll('button')).find(
      (c) => c.textContent?.trim() === 'Alpha',
    )!;
    alpha.click();
    expect(onChange).toHaveBeenCalledWith(['p2']);
  });

  it('renders nothing when there are no projects', () => {
    render(ProjectMultiselect, {
      props: { selected: [], onChange: () => {} },
      context: recordOptionsContext({ users: [], records: [], projects: [] }),
    });
    expect(document.querySelector('button')).toBeNull();
  });
});
