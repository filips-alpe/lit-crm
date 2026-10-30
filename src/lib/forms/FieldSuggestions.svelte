<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { addFieldFromSuggestion, type FieldSuggestion } from './builder';
  import { suggestFields } from './aiSuggest';
  import { kindMeta } from './kindMeta';
  import Icon from './Icon.svelte';
  import type { FormLayout } from './layout';
  import { humanizeIdentifier } from '$lib/utils/humanize';
  import * as m from '$lib/paraglide/messages.js';

  const SUGGEST_DEBOUNCE_MS = 500;
  const SKELETON_COUNT = 3;

  let {
    layout = $bindable(),
    typeCode = null,
    typeDescription = null,
    onVisibilityChange,
  }: {
    layout: FormLayout;
    typeCode?: string | null;
    typeDescription?: string | null;
    onVisibilityChange?: (visible: boolean) => void;
  } = $props();

  let suggestions = $state<FieldSuggestion[]>([]);
  let loadingSuggestions = $state(false);
  let suggestRequestId = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let inflight: AbortController | null = null;

  $effect(() => {
    const visible = loadingSuggestions || suggestions.length > 0;
    onVisibilityChange?.(visible);
  });

  $effect(() => {
    const code = typeCode;
    const desc = typeDescription;
    const snapshot: FormLayout = { ...layout, fields: [...layout.fields] };

    if (debounceTimer) clearTimeout(debounceTimer);
    // A newer request supersedes the in-flight one, so stop the model run too.
    inflight?.abort();
    const controller = (inflight = new AbortController());
    const reqId = ++suggestRequestId;
    debounceTimer = setTimeout(async () => {
      loadingSuggestions = true;
      try {
        const result = await suggestFields(
          snapshot,
          { typeCode: code, typeDescription: desc },
          controller.signal,
        );
        if (reqId !== suggestRequestId) return;
        suggestions = result;
      } finally {
        if (reqId === suggestRequestId) loadingSuggestions = false;
      }
    }, SUGGEST_DEBOUNCE_MS);
  });

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    inflight?.abort();
  });

  async function accept(suggestion: FieldSuggestion) {
    const next = addFieldFromSuggestion(layout, suggestion);
    if (next === layout) return;
    layout = next;
    suggestions = suggestions.filter((s) => s.writeTo !== suggestion.writeTo);
    // The clicked button is gone; keep focus useful by landing on the new field.
    await tick();
    const added = layout.fields[layout.fields.length - 1];
    document.querySelector<HTMLElement>(`[data-testid="field-label-${added.id}"]`)?.focus();
  }
</script>

<div aria-live="polite">
  {#if loadingSuggestions && suggestions.length === 0}
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <span class="loading loading-xs loading-spinner text-base-content/40"></span>
        <span class="text-[11px] font-semibold tracking-wide text-base-content/40 uppercase">
          {m.heavy_livid_crocodile_boost()}
        </span>
      </div>
      <ul class="flex flex-col gap-3">
        {#each Array(SKELETON_COUNT).keys() as i (i)}
          <li class="flex flex-col gap-1.5">
            <div class="h-3 w-32 skeleton"></div>
            <div class="h-10 w-full skeleton"></div>
          </li>
        {/each}
      </ul>
    </div>
  {:else if suggestions.length > 0}
    <ul class="flex flex-col gap-3" data-testid="suggestion-list">
      {#each suggestions as suggestion (suggestion.writeTo)}
        <li>
          <button
            type="button"
            onclick={() => accept(suggestion)}
            data-testid={`suggest-accept-${suggestion.writeTo}`}
            title={m.fresh_shy_canary_dart()}
            class="group flex w-full flex-col gap-2 rounded-box border border-dashed border-base-300 bg-base-100/70 px-3 py-2.5 text-left transition hover:border-base-content/40 hover:bg-base-100"
            style="background-image: repeating-linear-gradient(45deg, transparent 0, transparent 6px, rgba(0,0,0,0.03) 6px, rgba(0,0,0,0.03) 12px);"
          >
            <span class="flex items-center gap-2">
              <span
                class="flex-1 truncate text-sm font-medium text-base-content/60 decoration-base-content/30 decoration-dotted underline-offset-4 group-hover:text-base-content group-hover:underline"
              >
                {suggestion.label}
              </span>
              <span
                class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-base-300 bg-base-100 px-2 py-1 text-xs font-medium text-base-content/60"
              >
                <Icon name={suggestion.kind} class="size-3.5 text-base-content/50" />
                <span>{kindMeta(suggestion.kind).label}</span>
              </span>
              <span
                title={m.blue_bad_worm_bloom({ column: suggestion.writeTo })}
                class="inline-flex max-w-[200px] items-center gap-1 rounded-md border border-dashed border-base-300 bg-base-100 px-1.5 py-1 text-[11px] text-base-content/50"
              >
                <Icon name="arrow" class="size-3 shrink-0" />
                <span class="truncate">{humanizeIdentifier(suggestion.writeTo)}</span>
              </span>
            </span>
            <span
              class="flex h-9 w-full items-center rounded-md border border-dashed border-base-300 bg-base-100/70 px-3 text-sm text-base-content/30 group-hover:border-base-content/30"
            >
              {suggestion.kind === 'number'
                ? '0'
                : suggestion.kind === 'date'
                  ? m.loud_such_badger_slurp()
                  : suggestion.kind === 'datetime'
                    ? m.proof_real_hawk_honor()
                    : suggestion.kind === 'list'
                      ? m.spry_curly_wombat_lend()
                      : ''}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
