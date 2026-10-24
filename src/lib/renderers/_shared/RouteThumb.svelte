<script lang="ts">
  import {
    landPaths,
    projectEquirect,
    quadArc,
    viewBoxFor,
    type Point,
  } from '$lib/maps/projection';

  let {
    from,
    to,
    color = '#6a1b9a',
  }: {
    from: Point | null;
    to: Point | null;
    color?: string;
  } = $props();

  // Land outline is static and memoised in the projection module.
  const land = landPaths();

  const points = $derived([from, to].filter((p): p is Point => p !== null));
  const viewBox = $derived(viewBoxFor(points));
  const vb = $derived(viewBox.split(' ').map(Number));
  // Pin size derived from the framed span so it reads the same regardless of
  // how far apart the two ends are (a regional pin vs a transatlantic arc).
  const dotR = $derived(vb[2] * 0.02);

  const pFrom = $derived(from ? projectEquirect(from.lng, from.lat) : null);
  const pTo = $derived(to ? projectEquirect(to.lng, to.lat) : null);

  const arc = $derived(pFrom && pTo ? quadArc(pFrom, pTo) : null);
</script>

<!-- Decorative: the card overlays a "From → To" caption that conveys the same
     to assistive tech. `meet` keeps both ends in frame on wide routes; the
     sea-coloured background fills the letterbox bands so they read as ocean. -->
<svg
  {viewBox}
  preserveAspectRatio="xMidYMid meet"
  class="h-full w-full"
  style="background-color:#e9eef1"
  aria-hidden="true"
>
  <!-- sea -->
  <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill="#e9eef1" />
  <!-- sepia land, clipped by the viewBox -->
  {#each land as d (d)}
    <path
      {d}
      fill="#ddccab"
      stroke="#bda782"
      stroke-width="0.4"
      vector-effect="non-scaling-stroke"
    />
  {/each}

  {#if arc}
    <path
      d={arc}
      fill="none"
      stroke={color}
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-dasharray="3.5 2.5"
      vector-effect="non-scaling-stroke"
    />
  {/if}

  {#if pFrom}
    <circle
      cx={pFrom[0]}
      cy={pFrom[1]}
      r={dotR}
      fill="#fff"
      stroke={color}
      stroke-width="1.4"
      vector-effect="non-scaling-stroke"
    />
  {/if}

  {#if pTo}
    <circle
      cx={pTo[0]}
      cy={pTo[1]}
      r={dotR}
      fill={color}
      stroke="#fff"
      stroke-width="1.4"
      vector-effect="non-scaling-stroke"
    />
  {/if}
</svg>
