<script lang="ts">
  import { DEFAULT_TYPE_COLOR } from '$lib/schemas/types';
  import Icon from '$lib/forms/Icon.svelte';
  import { rovingIndex } from '$lib/utils/roving';
  import * as m from '$lib/paraglide/messages.js';

  const COLORS = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#d946ef',
    '#ec4899',
  ];

  let { value = $bindable() }: { value?: string } = $props();

  const currentColor = $derived((value ?? '').toLowerCase());
  const swatchIndex = $derived(COLORS.indexOf(currentColor));
  const customColorSelected = $derived(currentColor !== '' && swatchIndex < 0);

  let swatchRefs: (HTMLElement | null)[] = $state([]);
  let customColorInput: HTMLInputElement | null = $state(null);
  const currentSwatchIndex = $derived(
    swatchIndex >= 0 ? swatchIndex : customColorSelected ? COLORS.length : 0,
  );

  function openCustomColorPicker() {
    if (!customColorInput) return;
    try {
      customColorInput.showPicker();
    } catch {
      customColorInput.click();
    }
  }

  function onSwatchKeydown(e: KeyboardEvent) {
    const len = COLORS.length + 1;
    if ((e.key === 'Enter' || e.key === ' ') && currentSwatchIndex === COLORS.length) {
      e.preventDefault();
      openCustomColorPicker();
      return;
    }
    const next = rovingIndex(e.key, currentSwatchIndex, len);
    if (next === null) return;
    e.preventDefault();
    if (next < COLORS.length) value = COLORS[next];
    swatchRefs[next]?.focus();
  }
</script>

<div class="fieldset">
  <div id="color-legend" class="fieldset-legend flex w-full items-baseline justify-between pb-1">
    <span>{m.early_helpful_capybara_embrace()}</span>
    <span class="font-mono text-[11px] font-normal text-base-content/40 uppercase">
      {currentColor}
    </span>
  </div>
  <div
    role="radiogroup"
    aria-labelledby="color-legend"
    tabindex={-1}
    class="flex flex-wrap gap-2 p-1"
    onkeydown={onSwatchKeydown}
  >
    {#each COLORS as color, i (color)}
      {@const selected = color === currentColor}
      <button
        bind:this={swatchRefs[i]}
        type="button"
        onclick={(e) => {
          value = color;
          e.currentTarget.focus();
        }}
        role="radio"
        aria-label={color}
        aria-checked={selected}
        tabindex={i === currentSwatchIndex ? 0 : -1}
        title={color}
        class={[
          'flex size-9 items-center justify-center rounded-xl shadow-sm transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 active:scale-95',
          selected ? 'ring-2 ring-offset-2 ring-offset-base-100' : 'hover:scale-105',
        ]}
        style="background-color: {color}; --tw-ring-color: {color}"
      >
        {#if selected}
          <Icon name="check" size={18} stroke="white" strokeWidth={3} />
        {/if}
      </button>
    {/each}
    <div class="relative">
      <input
        bind:this={customColorInput}
        type="color"
        {@attach (node: HTMLInputElement) => {
          // Client-only: an SSR value attribute gets stripped on hydration, which
          // momentarily empties a color input and makes Chrome warn.
          node.value = value || DEFAULT_TYPE_COLOR;
        }}
        tabindex={-1}
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 size-full opacity-0"
        oninput={(e) => (value = e.currentTarget.value)}
      />
      <button
        bind:this={swatchRefs[COLORS.length]}
        type="button"
        role="radio"
        aria-label={m.mean_left_parrot_reap()}
        aria-checked={customColorSelected}
        tabindex={currentSwatchIndex === COLORS.length ? 0 : -1}
        onclick={(e) => {
          e.currentTarget.focus();
          openCustomColorPicker();
        }}
        title={customColorSelected
          ? (value ?? m.mean_left_parrot_reap())
          : m.mean_left_parrot_reap()}
        class={[
          'relative flex size-9 cursor-pointer items-center justify-center rounded-xl transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 active:scale-95',
          customColorSelected
            ? 'shadow-sm ring-2 ring-offset-2 ring-offset-base-100 hover:scale-105'
            : 'border-2 border-dashed border-base-300 text-base-content/50 hover:scale-105 hover:border-primary hover:text-primary',
        ]}
        style={customColorSelected
          ? `background-color: ${value}; --tw-ring-color: ${value}`
          : '--tw-ring-color: var(--color-primary)'}
      >
        {#if customColorSelected}
          <Icon name="check" size={18} stroke="white" strokeWidth={3} />
        {:else}
          <Icon name="palette" size={16} />
        {/if}
      </button>
    </div>
  </div>
</div>
