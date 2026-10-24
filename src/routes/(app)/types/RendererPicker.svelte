<script lang="ts">
  import RendererPreview from './RendererPreview.svelte';
  import { recordRenderers } from '$lib/renderers/registry';
  import type { FormLayout } from '$lib/forms/layout';
  import { rovingIndex } from '$lib/utils/roving';
  import * as m from '$lib/paraglide/messages.js';

  let {
    value,
    onChange,
    layout,
    code,
    color,
    iconSeed,
    accent,
  }: {
    value: string | null;
    onChange: (id: string | null) => void;
    layout: FormLayout | null;
    code: string;
    color: string;
    iconSeed: string | null;
    accent: string;
  } = $props();

  // Every option renders a card + row preview, so re-rendering them all on each
  // keystroke in the form is costly. Previews follow the form after a short pause.
  const PREVIEW_DEBOUNCE_MS = 250;
  // svelte-ignore state_referenced_locally
  let previewInput = $state.raw({ layout, code, color, iconSeed });
  $effect(() => {
    const next = { layout, code, color, iconSeed };
    const timer = setTimeout(() => (previewInput = next), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  type Option = { id: string | null; name: string };
  // Derived so the Default label follows a locale switch.
  const options: Option[] = $derived([
    { id: null, name: m.such_spry_kestrel_pout() },
    ...recordRenderers.map((r) => ({ id: r.id, name: r.name })),
  ]);

  let buttons = $state<HTMLElement[]>([]);
  const selectedIndex = $derived(
    Math.max(
      0,
      options.findIndex((o) => o.id === value),
    ),
  );

  function select(i: number) {
    onChange(options[i].id);
    buttons[i]?.focus();
  }

  // Roving-tabindex radiogroup: arrow keys move and select, Home/End jump.
  function onKeydown(e: KeyboardEvent, i: number) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      select(i);
      return;
    }
    const next = rovingIndex(e.key, i, options.length);
    if (next === null) return;
    e.preventDefault();
    select(next);
  }
</script>

<div role="radiogroup" aria-label={m.loud_best_hedgehog_forgive()} class="flex flex-col gap-3">
  {#each options as opt, i (opt.id ?? 'default')}
    {@const checked = opt.id === value}
    <!-- A div, not a button: the preview inside is flow content, which a button can't hold. -->
    <div
      role="radio"
      aria-checked={checked}
      aria-label={opt.name}
      tabindex={i === selectedIndex ? 0 : -1}
      bind:this={buttons[i]}
      onclick={() => select(i)}
      onkeydown={(e) => onKeydown(e, i)}
      class="flex cursor-pointer flex-col rounded-box border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      class:border-base-300={!checked}
      style={checked
        ? `border-color: ${accent}; background-color: ${accent}14; outline-color: ${accent}`
        : `outline-color: ${accent}`}
    >
      <div class="mb-2 flex items-center gap-2">
        <span class="text-xs font-medium">{opt.name}</span>
        {#if checked}
          <span
            class="flex size-4 items-center justify-center rounded-full text-[10px] leading-none text-white"
            style="background-color: {accent}"
            aria-hidden="true"
          >
            ✓
          </span>
        {/if}
      </div>
      <div aria-hidden="true" class="pointer-events-none min-w-0">
        <RendererPreview
          rendererId={opt.id}
          layout={previewInput.layout}
          code={previewInput.code}
          color={previewInput.color}
          iconSeed={previewInput.iconSeed}
        />
      </div>
    </div>
  {/each}
</div>
