<script lang="ts">
  import PersonChip from '$lib/renderers/_shared/PersonChip.svelte';
  import type { Correspondent } from '../types';

  // Ranked correspondents (feed it `data.correspondents`): chip + count bar.
  let {
    people,
    limit = 8,
    color = '#b45309',
    empty,
    class: className,
  }: {
    people: Correspondent[];
    limit?: number;
    /** Avatar tint + bar colour. */
    color?: string;
    empty?: string;
    class?: string;
  } = $props();

  const shown = $derived(people.slice(0, limit));
  const max = $derived(Math.max(1, ...shown.map((p) => p.total)));
</script>

{#if shown.length}
  <ul class={['space-y-1.5', className]}>
    {#each shown as p (p.name)}
      <li class="flex items-center gap-3">
        <PersonChip name={p.name} {color} compact class="w-44 shrink-0" />
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
          <div
            class="h-full rounded-full"
            style="width: {(p.total / max) * 100}%; background-color: {color}"
          ></div>
        </div>
        <span class="w-8 text-right text-xs text-stone-500 tabular-nums">{p.total}</span>
      </li>
    {/each}
  </ul>
{:else if empty}
  <p class="text-sm text-stone-400">{empty}</p>
{/if}
