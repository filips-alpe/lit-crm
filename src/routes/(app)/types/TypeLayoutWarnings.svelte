<script lang="ts">
  import { layoutImpacts } from '$lib/forms/layoutImpact';
  import type { FormLayout } from '$lib/forms/layout';
  import AlertIcon from './AlertIcon.svelte';
  import * as m from '$lib/paraglide/messages.js';

  // Editing a type that already has records: warn (never block) when the unsaved
  // layout removes a field or moves it off a column that holds data.
  let {
    saved,
    layout,
    counts,
  }: { saved: FormLayout | null; layout: FormLayout | null; counts: Record<string, number> } =
    $props();

  const impacts = $derived(saved && layout ? layoutImpacts(saved, layout, counts) : []);

  function message(i: (typeof impacts)[number]): string {
    const args = { field: i.label, column: i.column, count: i.count };
    if (i.reason === 'removed') return m.white_sleek_panther_empower(args);
    if (i.reason === 'kind') return m.away_slow_pig_grow(args);
    return m.big_merry_albatross_value(args);
  }
</script>

{#if impacts.length > 0}
  <div role="alert" class="mt-4 alert alert-soft alert-warning" data-testid="layout-impact-warning">
    <AlertIcon />
    <ul class="list-inside list-disc text-sm">
      {#each impacts as impact (impact.fieldId)}
        <li>{message(impact)}</li>
      {/each}
    </ul>
  </div>
{/if}
