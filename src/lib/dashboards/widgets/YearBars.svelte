<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { YearCount } from '../types';

  // Bar-per-year histogram (feed it `data.byYear`). Pure SVG, scales to width.
  let {
    data,
    color = '#d97706',
    height = 72,
    class: className,
  }: {
    data: YearCount[];
    color?: string;
    height?: number;
    class?: string;
  } = $props();

  const max = $derived(Math.max(1, ...data.map((d) => d.count)));
  const gap = 0.15;
</script>

{#if data.length}
  <figure class={className}>
    <svg
      viewBox="0 0 {data.length} {height}"
      preserveAspectRatio="none"
      class="w-full"
      style="height: {height}px"
      role="img"
      aria-label={m.nimble_north_gibbon_blink({
        first: data[0].year,
        last: data[data.length - 1].year,
      })}
    >
      {#each data as d, i (d.year)}
        {@const h = (d.count / max) * (height - 2)}
        <rect x={i + gap / 2} y={height - h} width={1 - gap} height={h} fill={color} rx="0.1">
          <title>{d.year}: {d.count}</title>
        </rect>
      {/each}
    </svg>
    <figcaption class="mt-1 flex justify-between text-xs text-stone-500 tabular-nums">
      <span>{data[0].year}</span>
      <span>{data[data.length - 1].year}</span>
    </figcaption>
  </figure>
{/if}
