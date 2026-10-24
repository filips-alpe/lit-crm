import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import RelationInput from './RelationInput.svelte';
import { recordOptionsContext, type RecordFormOptions } from '$lib/forms/recordOptions';

const OPTIONS: RecordFormOptions = {
  users: [{ id: 'u2', name: 'Alan Turing', username: 'alan', color: '#000000', avatarSeed: null }],
  records: [{ id: 'r1', label: 'Prior letter' }],
  projects: [],
  excludeRecordId: 'self',
};

const USER_HITS = [
  { id: 'u1', name: 'Ada Lovelace', username: 'ada', color: '#000000', avatarSeed: null },
  { id: 'u3', name: 'Adam Smith', username: 'adam', color: '#000000', avatarSeed: null },
];

function stubFetch(rows: unknown[] = USER_HITS) {
  const fn = vi.fn<typeof fetch>(async () => Response.json({ options: rows }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

function renderRelation(props: {
  kind?: 'user' | 'record';
  value?: unknown;
  onChange?: (v: unknown) => void;
}) {
  const kind = props.kind ?? 'user';
  return render(RelationInput, {
    props: {
      field: {
        id: 'a',
        label: 'Person',
        kind,
        writeTo: kind === 'user' ? 'creatorId' : 'recordId',
      },
      value: props.value,
      controlProps: { id: 'ctl' },
      hasError: false,
      onChange: props.onChange ?? (() => {}),
    },
    context: recordOptionsContext(OPTIONS),
  });
}

const combobox = () => document.querySelector('[role=combobox]') as HTMLInputElement;
const optionTexts = () =>
  Array.from(document.querySelectorAll('[role=option]')).map((o) => o.textContent?.trim());

describe('RelationInput (async combobox)', () => {
  it('exposes the ARIA combobox pattern and shows the selected label from context', () => {
    stubFetch();
    renderRelation({ value: 'u2' });
    const input = combobox();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.value).toBe('Alan Turing');
  });

  it('opens on focus, searches, and renders the options as a listbox', async () => {
    const fetchFn = stubFetch();
    renderRelation({});
    await userEvent.click(combobox());
    await expect.poll(optionTexts).toEqual(['Ada Lovelace', 'Adam Smith']);
    expect(combobox().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role=listbox]')).not.toBeNull();
    expect(String(fetchFn.mock.calls[0][0])).toBe('/data/options?kind=user&q=');
  });

  it('debounces typing into a single request carrying the query', async () => {
    const fetchFn = stubFetch();
    renderRelation({});
    await userEvent.click(combobox());
    await expect.poll(() => fetchFn.mock.calls.length).toBe(1);
    // Three keystrokes in the same tick — well inside the debounce window
    // however loaded the machine is — must coalesce into one request.
    const input = combobox();
    for (const value of ['a', 'ad', 'ada']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await expect.poll(() => fetchFn.mock.calls.length).toBe(2);
    await new Promise((r) => setTimeout(r, 500));
    expect(fetchFn.mock.calls.length).toBe(2);
    expect(String(fetchFn.mock.calls[1][0])).toBe('/data/options?kind=user&q=ada');
  });

  it('selects with the keyboard and reports the id', async () => {
    stubFetch();
    const onChange = vi.fn();
    renderRelation({ onChange });
    await userEvent.click(combobox());
    await expect.poll(optionTexts).toHaveLength(2);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('u3');
    expect(combobox().getAttribute('aria-expanded')).toBe('false');
  });

  it('does not pick a stale highlight on Enter while a new search is pending; picks from the fresh results', async () => {
    const fn = vi.fn<typeof fetch>(async (input) => {
      const q = new URL(String(input), 'http://x').searchParams.get('q');
      return Response.json({
        options:
          q === 'smi'
            ? [{ id: 'u9', name: 'Smith', username: 's', color: '#000', avatarSeed: null }]
            : USER_HITS,
      });
    });
    vi.stubGlobal('fetch', fn);
    const onChange = vi.fn();
    renderRelation({ onChange });
    await userEvent.click(combobox());
    await expect.poll(optionTexts).toHaveLength(2);
    // Type and press Enter in the same tick, inside the debounce window.
    const input = combobox();
    input.value = 'smi';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
    await expect.poll(() => onChange.mock.calls.length).toBe(1);
    expect(onChange).toHaveBeenCalledWith('u9');
  });

  it('stays open when the popup itself is pressed (scrollbar drag)', async () => {
    stubFetch();
    renderRelation({});
    await userEvent.click(combobox());
    await expect.poll(optionTexts).toHaveLength(2);
    const popup = document.querySelector('[role=listbox]')!.parentElement!;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    popup.dispatchEvent(down);
    // preventDefault keeps focus (and so the list) on the input.
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(combobox());
    expect(combobox().getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Escape without selecting', async () => {
    stubFetch();
    const onChange = vi.fn();
    renderRelation({ onChange });
    await userEvent.click(combobox());
    await expect.poll(optionTexts).toHaveLength(2);
    await userEvent.keyboard('{Escape}');
    expect(combobox().getAttribute('aria-expanded')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears the selection through the clear button', async () => {
    stubFetch();
    const onChange = vi.fn();
    renderRelation({ value: 'u2', onChange });
    (document.querySelector('button[aria-label]') as HTMLButtonElement).click();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('asks for records excluding the record being edited', async () => {
    const fetchFn = stubFetch([{ id: 'r9', label: 'Another' }]);
    renderRelation({ kind: 'record' });
    await userEvent.click(combobox());
    await expect.poll(optionTexts).toEqual(['Another']);
    expect(String(fetchFn.mock.calls[0][0])).toBe('/data/options?kind=record&q=&exclude=self');
  });

  it('reports a failed search instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'unauthorized' }, { status: 401 })),
    );
    renderRelation({});
    await userEvent.click(combobox());
    await expect
      .poll(() => document.querySelector('[role=status]')?.textContent?.trim())
      .toBe('Search failed');
  });
});
