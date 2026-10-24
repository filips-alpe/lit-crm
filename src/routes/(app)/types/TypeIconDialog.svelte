<script lang="ts">
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import { humanizeIconName, sampleIcons, TYPE_ICONS } from '$lib/icons/typeIcons';
  import { suggestIcons } from '$lib/icons/suggestIcons';
  import * as m from '$lib/paraglide/messages.js';

  const ICON_COUNT = 24;

  let {
    iconSeed = $bindable(),
    code,
    description,
    accent,
  }: {
    iconSeed?: string | null;
    code: string;
    description?: string | null;
    accent: string;
  } = $props();

  let seeds = $state<string[]>(sampleIcons(ICON_COUNT));
  let dialog = $state<HTMLDialogElement | null>(null);
  let open = $state(false);

  /** Open the picker (the parent's logo button calls this). */
  export function show() {
    open = true;
    dialog?.showModal();
  }

  // Immediate first suggestion, then debounced; the cleanup drops stale results
  // and aborts a model run that is still going.
  let firstSuggest = true;
  $effect(() => {
    const typeCode = code;
    const typeDescription = description;
    const controller = new AbortController();
    let stale = false;
    const timer = setTimeout(
      async () => {
        const picks = await suggestIcons(
          { typeCode, typeDescription },
          ICON_COUNT,
          controller.signal,
        );
        if (!stale) seeds = picks;
      },
      firstSuggest ? 0 : 500,
    );
    firstSuggest = false;
    return () => {
      stale = true;
      controller.abort();
      clearTimeout(timer);
    };
  });

  const filteredIcons = $derived.by(() => {
    const seed = iconSeed;
    const ranked =
      !seed || seeds.includes(seed) ? seeds : [seed, ...seeds.slice(0, seeds.length - 1)];
    const rankedSet = new Set(ranked);
    const rest = TYPE_ICONS.filter((n) => !rankedSet.has(n));
    return [...ranked, ...rest];
  });
</script>

<dialog
  bind:this={dialog}
  class="modal"
  aria-labelledby="icon-dialog-title"
  onclose={() => (open = false)}
>
  <div class="modal-box flex max-h-[85vh] max-w-2xl flex-col p-0">
    <div class="min-w-0 border-b border-base-300 p-5">
      <h3 id="icon-dialog-title" class="text-base font-semibold">
        {m.patchy_few_reindeer_tend()}
      </h3>
      {#if iconSeed}
        <p class="mt-0.5 truncate text-xs text-base-content/60">
          {m.gaudy_short_bumblebee_breathe()}
          <span class="font-medium text-base-content">
            {humanizeIconName(iconSeed)}
          </span>
        </p>
      {/if}
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <!-- Only while open: ~150 icon images would otherwise load from a third party on every page view. -->
      {#if open}
        <div class="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {#each filteredIcons as seed (seed)}
            {@const selected = seed === iconSeed}
            <button
              type="button"
              onclick={() => {
                iconSeed = seed;
                dialog?.close();
              }}
              aria-label={humanizeIconName(seed)}
              aria-pressed={selected}
              title={humanizeIconName(seed)}
              class={[
                'group flex aspect-square items-center justify-center rounded-box transition active:scale-95',
                selected ? '' : 'hover:bg-base-200',
              ]}
              style={selected
                ? `box-shadow: 0 0 0 2px var(--color-base-100) inset, 0 0 0 3px ${accent}`
                : ''}
            >
              <TypeBadge
                code={code || seed}
                color={accent}
                iconSeed={seed}
                class="size-10 rounded-xl transition group-hover:scale-105"
              />
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="flex items-center justify-between gap-2 border-t border-base-300 p-4">
      <span class="text-xs text-base-content/50">
        {m.icy_solid_jellyfish_peek({ count: filteredIcons.length })}
      </span>
      <button type="button" class="btn btn-ghost" onclick={() => dialog?.close()}>
        {m.acidic_jolly_ladybug_slide()}
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label={m.major_sleek_macaw_shine()}>{m.yummy_alive_termite_commend()}</button>
  </form>
</dialog>
