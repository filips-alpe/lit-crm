<script lang="ts">
  import CorrespondenceMap from '$lib/renderers/_shared/CorrespondenceMap.svelte';
  import type { GeoRoute } from '../types';

  // Mini offline map of letter routes (feed it `data.geo`). Each arc links to its
  // letter. Renders nothing when there are no routes.
  let {
    routes,
    color = '#b45309',
    class: className,
  }: { routes: GeoRoute[]; color?: string; class?: string } = $props();

  const letters = $derived(
    routes.map((r) => ({
      id: r.id,
      from: r.fromGeo,
      to: r.toGeo,
      label: r.title ?? [r.from, r.to].filter(Boolean).join(' → '),
    })),
  );
</script>

{#if routes.length}
  <div class={['aspect-[2/1] overflow-hidden rounded-md border border-stone-200', className]}>
    <CorrespondenceMap {letters} currentId="" {color} />
  </div>
{/if}
