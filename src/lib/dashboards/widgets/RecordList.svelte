<script lang="ts">
  import { resolve } from '$app/paths';
  import RecordRow from '$lib/components/RecordRow.svelte';
  import RecordCard from '$lib/components/RecordCard.svelte';
  import * as m from '$lib/paraglide/messages.js';
  import type { DashboardRecord } from '../types';

  // Records rendered with the app's own row/card components, so each type's
  // renderer applies. Every entry links to the record page through a stretched
  // link laid over the entry (not a wrapping anchor), so the clickable chips a
  // renderer may contain are never nested inside another link.
  let {
    records,
    variant = 'row',
    limit,
    empty = m.long_red_puma_agree(),
    class: className,
  }: {
    records: DashboardRecord[];
    variant?: 'row' | 'card';
    limit?: number;
    empty?: string;
    class?: string;
  } = $props();

  const shown = $derived(limit ? records.slice(0, limit) : records);

  const labelOf = (row: DashboardRecord) => row.title ?? row.note ?? row.type.code;
</script>

{#if shown.length === 0}
  <p class="py-3 text-center text-sm text-stone-400">{empty}</p>
{:else if variant === 'card'}
  <div class={['grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3', className]}>
    {#each shown as row (row.id)}
      <div class="relative rounded">
        <RecordCard {row} type={row.type} />
        <a
          href={resolve('/(app)/data/[id]', { id: row.id })}
          aria-label={labelOf(row)}
          class="absolute inset-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        ></a>
      </div>
    {/each}
  </div>
{:else}
  <div class={['divide-y divide-stone-200 rounded border border-stone-200 bg-white', className]}>
    {#each shown as row (row.id)}
      <div class="relative hover:bg-stone-50 has-[a:focus-visible]:bg-stone-50">
        <RecordRow {row} type={row.type} />
        <a
          href={resolve('/(app)/data/[id]', { id: row.id })}
          aria-label={labelOf(row)}
          class="absolute inset-0 focus:outline-none"
        ></a>
      </div>
    {/each}
  </div>
{/if}
