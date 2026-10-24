<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, present } from '$lib/render/select';
  import CardShell from '../_shared/CardShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));
  const venue = $derived(byWriteTo(fields, 'to'));
  const penName = $derived(byWriteTo(fields, 'from'));

  const byline = $derived(
    [
      present(venue) ? m.mellow_plane_midge_quell({ place: asText(venue.value) }) : null,
      present(penName) ? m.lime_civil_crossbill_soar({ name: asText(penName.value) }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
  );
</script>

<CardShell {creator} {createdAt} {status} bg="#fafaf9">
  <div class="flex h-full min-w-0 flex-col items-center justify-center gap-1.5 p-3 text-center">
    <span class="h-0.5 w-8" style="background:{type.color}" aria-hidden="true"></span>
    {#if present(title)}
      <p class="line-clamp-3 font-display text-base leading-snug text-stone-900 italic">
        “{asText(title.value)}”
      </p>
    {:else}
      <span class="text-sm text-stone-400">—</span>
    {/if}
    {#if byline}
      <span class="truncate text-[11px] tracking-wide text-stone-500 uppercase">{byline}</span>
    {/if}
  </div>
</CardShell>
