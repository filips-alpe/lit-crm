<script lang="ts">
  import { resolve } from '$app/paths';
  import {
    landPaths,
    projectEquirect,
    quadArc,
    viewBoxFor,
    type Point,
  } from '$lib/maps/projection';
  import * as m from '$lib/paraglide/messages.js';

  // One letter as a route to draw: its id, two (optional) endpoints, and a label
  // for the path's tooltip / accessible name.
  interface MapRoute {
    id: string;
    from: Point | null;
    to: Point | null;
    label: string;
  }

  // The correspondence drawn as a small offline map: every letter is an arc
  // between its endpoints. The current letter is highlighted and inert; the rest
  // are muted and clickable — `onSelect` flips the modal in place when supplied,
  // otherwise each path is a plain link to that letter's page.
  let {
    letters,
    currentId,
    color = '#6a1b9a',
    onSelect,
  }: {
    letters: MapRoute[];
    currentId: string;
    color?: string;
    onSelect?: (id: string) => void;
  } = $props();

  // Land outline is static and memoised in the projection module.
  const land = landPaths();

  // Frame every endpoint of every letter so the whole correspondence is in view.
  const points = $derived(
    letters.flatMap((l) => [l.from, l.to]).filter((p): p is Point => p !== null),
  );
  const viewBox = $derived(viewBoxFor(points));
  const vb = $derived(viewBox.split(' ').map(Number));
  const dotR = $derived(vb[2] * 0.02);

  interface Drawn {
    id: string;
    label: string;
    pFrom: number[] | null;
    pTo: number[] | null;
    arc: string | null;
    current: boolean;
  }

  function draw(l: MapRoute): Drawn {
    const pFrom = l.from ? projectEquirect(l.from.lng, l.from.lat) : null;
    const pTo = l.to ? projectEquirect(l.to.lng, l.to.lat) : null;
    return {
      id: l.id,
      label: l.label,
      pFrom,
      pTo,
      arc: pFrom && pTo ? quadArc(pFrom, pTo) : null,
      current: l.id === currentId,
    };
  }

  // Others first, the current letter last so its highlighted route paints on top.
  const drawn = $derived(letters.map(draw).sort((a, b) => Number(a.current) - Number(b.current)));

  function activate(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(id);
    }
  }
</script>

<!-- A click-through map of the correspondence. The sea-coloured background fills
     the letterbox bands so they read as ocean; `meet` keeps every endpoint in
     frame. -->
<svg
  {viewBox}
  preserveAspectRatio="xMidYMid meet"
  class="h-full w-full"
  style="background-color:#e9eef1"
  role="group"
  aria-label={m.witty_chunky_squirrel_value()}
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

  {#each drawn as r (r.id)}
    {#if r.current}
      {@render shape(r, false)}
    {:else if onSelect}
      <g
        role="button"
        tabindex="0"
        class="cursor-pointer"
        aria-label={m.misty_level_clownfish_care({ label: r.label })}
        onclick={() => onSelect?.(r.id)}
        onkeydown={(e) => activate(e, r.id)}
      >
        <title>{r.label}</title>
        {@render shape(r, true)}
        {@render hit(r)}
      </g>
    {:else}
      <a
        href={resolve('/(app)/data/[id]', { id: r.id })}
        class="cursor-pointer"
        aria-label={m.misty_level_clownfish_care({ label: r.label })}
      >
        <title>{r.label}</title>
        {@render shape(r, true)}
        {@render hit(r)}
      </a>
    {/if}
  {/each}
</svg>

<!-- The arc + its two pins. `muted` thins and greys a non-current letter so the
     highlighted one reads first. -->
{#snippet shape(r: Drawn, muted: boolean)}
  {#if r.arc}
    <path
      d={r.arc}
      fill="none"
      stroke={muted ? '#8a7f6f' : color}
      stroke-width={muted ? 1 : 1.8}
      stroke-linecap="round"
      stroke-dasharray="3.5 2.5"
      stroke-opacity={muted ? 0.55 : 1}
      vector-effect="non-scaling-stroke"
    />
  {/if}
  {#if r.pFrom}
    <circle
      cx={r.pFrom[0]}
      cy={r.pFrom[1]}
      r={muted ? dotR * 0.7 : dotR}
      fill="#fff"
      stroke={muted ? '#8a7f6f' : color}
      stroke-width={muted ? 1 : 1.4}
      stroke-opacity={muted ? 0.7 : 1}
      vector-effect="non-scaling-stroke"
    />
  {/if}
  {#if r.pTo}
    <circle
      cx={r.pTo[0]}
      cy={r.pTo[1]}
      r={muted ? dotR * 0.7 : dotR}
      fill={muted ? '#8a7f6f' : color}
      fill-opacity={muted ? 0.6 : 1}
      stroke="#fff"
      stroke-width={muted ? 1 : 1.4}
      vector-effect="non-scaling-stroke"
    />
  {/if}
{/snippet}

<!-- A fat invisible band over the arc so the thin path is easy to click/tap. -->
{#snippet hit(r: Drawn)}
  {#if r.arc}
    <path
      d={r.arc}
      fill="none"
      stroke="transparent"
      stroke-width="10"
      vector-effect="non-scaling-stroke"
    />
  {/if}
{/snippet}
