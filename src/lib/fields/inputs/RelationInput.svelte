<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { FieldInputProps } from '../inputs';
  import { inputBorder } from '../inputHelpers';
  import { moveActive, SEARCH_DEBOUNCE_MS, searchOptions } from '../relationSearch';
  import {
    getRecordOptions,
    rememberRecord,
    rememberUser,
    type RecordOption,
    type UserOption,
  } from '$lib/forms/recordOptions';
  import * as m from '$lib/paraglide/messages.js';

  let { value, field, controlProps, hasError, onChange }: FieldInputProps = $props();

  // Only the already-selected labels come from the form root (via context); the
  // rest is searched on demand from /data/options.
  const options = getRecordOptions();

  interface Item {
    id: string;
    label: string;
  }

  const kind = $derived(field.kind === 'user' ? 'user' : 'record');
  const current = $derived(typeof value === 'string' ? value : '');
  const listId = $derived(`${controlProps.id ?? field.id}-listbox`);

  function labelOf(id: string): string {
    if (!id) return '';
    if (kind === 'user') return options.users.find((u) => u.id === id)?.name ?? id;
    return options.records.find((r) => r.id === id)?.label ?? id;
  }
  const selectedLabel = $derived(labelOf(current));

  let query = $state('');
  let open = $state(false);
  let items = $state<Item[]>([]);
  let active = $state(-1);
  let loading = $state(false);
  let failed = $state(false);
  let rawById = new Map<string, UserOption | RecordOption>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  // Bumped per request so a slow, superseded response can never overwrite newer results.
  let epoch = 0;
  // True from the keystroke until its results land: the highlight belongs to an
  // older query meanwhile. Enter pressed in that window is queued, not applied.
  let stale = false;
  let enterQueued = false;

  async function runSearch(q: string) {
    controller?.abort();
    controller = new AbortController();
    const mine = ++epoch;
    loading = true;
    failed = false;
    try {
      const rows = await searchOptions<UserOption | RecordOption>(
        { kind, q, excludeId: options.excludeRecordId },
        { signal: controller.signal },
      );
      if (mine !== epoch) return;
      rawById = new Map(rows.map((r) => [r.id, r]));
      items = rows.map((r) => ({
        id: r.id,
        label: 'name' in r ? r.name : r.label,
      }));
      active = items.length > 0 ? 0 : -1;
      stale = false;
      if (enterQueued) {
        enterQueued = false;
        if (items[active]) select(items[active]);
      }
    } catch {
      if (mine !== epoch) return;
      items = [];
      active = -1;
      failed = true;
      stale = false;
      enterQueued = false;
    } finally {
      if (mine === epoch) loading = false;
    }
  }

  function scheduleSearch(q: string) {
    stale = true;
    enterQueued = false;
    clearTimeout(timer);
    timer = setTimeout(() => void runSearch(q), SEARCH_DEBOUNCE_MS);
  }

  function openList() {
    if (open) return;
    open = true;
    void runSearch(query);
  }

  function closeList() {
    open = false;
    clearTimeout(timer);
    controller?.abort();
    epoch++;
    loading = false;
    stale = false;
    enterQueued = false;
    query = '';
    active = -1;
  }

  function select(item: Item) {
    const raw = rawById.get(item.id);
    if (raw) {
      if (kind === 'user') rememberUser(options, raw as UserOption);
      else rememberRecord(options, raw as RecordOption);
    }
    // Remembered above first, so previews recomputed on this change can label it.
    onChange(item.id);
    closeList();
  }

  function clear() {
    onChange(undefined);
    closeList();
  }

  function onInput(e: Event & { currentTarget: HTMLInputElement }) {
    query = e.currentTarget.value;
    if (!open) open = true;
    scheduleSearch(query);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        closeList();
      }
      return;
    }
    if (e.key === 'Enter') {
      // Never submit the surrounding form from the picker.
      if (open) e.preventDefault();
      if (open && stale) enterQueued = true;
      else if (open && active >= 0 && items[active]) select(items[active]);
      return;
    }
    if (e.key === 'Tab') return;
    const next = moveActive(active, e.key, items.length);
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      openList();
      return;
    }
    if (next !== null) {
      e.preventDefault();
      open = true;
      active = next;
    }
  }

  function onFocusOut(e: FocusEvent & { currentTarget: HTMLElement }) {
    const to = e.relatedTarget as Node | null;
    if (!to || !e.currentTarget.contains(to)) closeList();
  }

  onDestroy(() => {
    clearTimeout(timer);
    controller?.abort();
  });
</script>

<div class="relative" onfocusout={onFocusOut}>
  <div class="flex items-center gap-1">
    <input
      {...controlProps}
      type="text"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      value={open ? query : selectedLabel}
      placeholder={open && selectedLabel ? selectedLabel : m.tangy_close_gorilla_trim()}
      oninput={onInput}
      onkeydown={onKeydown}
      onfocus={openList}
      onclick={openList}
      class={['w-full rounded border px-2 py-1.5', inputBorder(hasError)]}
    />
    {#if current}
      <button
        type="button"
        class="btn btn-square btn-ghost btn-sm"
        aria-label={m.crazy_loose_nils_wave()}
        onclick={clear}
      >
        ×
      </button>
    {/if}
  </div>

  {#if open}
    <div
      class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border border-base-300 bg-base-100 shadow"
      role="presentation"
      onmousedown={(e) => e.preventDefault()}
    >
      <ul id={listId} role="listbox" aria-label={field.label}>
        {#each items as item, i (item.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <li
            id={`${listId}-${i}`}
            role="option"
            aria-selected={item.id === current}
            class={['cursor-pointer px-2 py-1', i === active && 'bg-base-200']}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => select(item)}
            onmousemove={() => (active = i)}
          >
            {item.label}
          </li>
        {/each}
      </ul>
      {#if loading || failed || items.length === 0}
        <p class="px-2 py-1 text-sm opacity-70" role="status">
          {#if loading}
            {m.curly_blue_mongoose_loop()}
          {:else if failed}
            {m.spicy_last_lemur_believe()}
          {:else}
            {m.sweet_male_mammoth_treat()}
          {/if}
        </p>
      {/if}
    </div>
  {/if}
</div>
