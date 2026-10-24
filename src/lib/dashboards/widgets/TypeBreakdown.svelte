<script lang="ts">
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import type { TypeCount } from '../types';

  // Records per type (feed it `data.countsByType`): badge, name, bar, count.
  let {
    counts,
    empty,
    class: className,
  }: { counts: TypeCount[]; empty?: string; class?: string } = $props();

  const max = $derived(Math.max(1, ...counts.map((c) => c.count)));
</script>

{#if counts.length}
  <ul class={['space-y-1.5', className]}>
    {#each counts as c (c.typeId)}
      <li class="flex items-center gap-3">
        <TypeBadge
          code={c.code}
          color={c.color}
          iconSeed={c.iconSeed}
          decorative
          class="size-5 rounded-md"
        />
        <span class="w-28 shrink-0 truncate text-sm text-stone-700">{c.code}</span>
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
          <div
            class="h-full rounded-full"
            style="width: {(c.count / max) * 100}%; background-color: {c.color}"
          ></div>
        </div>
        <span class="w-8 text-right text-xs text-stone-500 tabular-nums">{c.count}</span>
      </li>
    {/each}
  </ul>
{:else if empty}
  <p class="text-sm text-stone-400">{empty}</p>
{/if}
