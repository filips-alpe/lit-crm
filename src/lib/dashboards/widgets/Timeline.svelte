<script module lang="ts">
  export interface TimelineItem {
    id: string;
    date: Date | null;
    title: string;
    subtitle?: string | null;
    /** Dot colour (e.g. the record type's colour). */
    color?: string;
    /** Link to the record page when true (default). */
    link?: boolean;
  }
</script>

<script lang="ts">
  import { resolve } from '$app/paths';
  import { formatDate } from '$lib/utils/formatDate';

  // Vertical dated list with a rail. Items render in the order given.
  let {
    items,
    empty,
    class: className,
  }: { items: TimelineItem[]; empty?: string; class?: string } = $props();
</script>

{#if items.length}
  <ol class={['relative ml-1.5 border-l border-stone-200', className]}>
    {#each items as item (item.id)}
      <li class="relative pb-3 pl-4 last:pb-0">
        <span
          class="absolute top-1.5 -left-[5px] size-2.5 rounded-full ring-2 ring-white"
          style="background-color: {item.color ?? '#a8a29e'}"
        ></span>
        <div class="text-xs text-stone-500 tabular-nums">{formatDate(item.date)}</div>
        {#if item.link === false}
          <div class="text-sm text-stone-800">{item.title}</div>
        {:else}
          <a
            href={resolve('/(app)/data/[id]', { id: item.id })}
            class="text-sm text-stone-800 hover:underline">{item.title}</a
          >
        {/if}
        {#if item.subtitle}<div class="text-xs text-stone-500">{item.subtitle}</div>{/if}
      </li>
    {/each}
  </ol>
{:else if empty}
  <p class="text-sm text-stone-400">{empty}</p>
{/if}
