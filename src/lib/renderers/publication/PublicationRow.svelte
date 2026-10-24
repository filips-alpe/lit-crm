<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, present } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));
  const venue = $derived(byWriteTo(fields, 'to'));
  const penName = $derived(byWriteTo(fields, 'from'));

  const byline = $derived(
    [
      present(venue) ? `in ${asText(venue.value)}` : null,
      present(penName) ? `as ${asText(penName.value)}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  );
</script>

<RowShell {creator} {createdAt} {status}>
  <span class="h-4 w-0.5 shrink-0" style="background:{type.color}" aria-hidden="true"></span>
  {#if present(title)}
    <span class="truncate font-display text-stone-900 italic">“{asText(title.value)}”</span>
  {:else}
    <span class="text-stone-400">—</span>
  {/if}
  {#if byline}
    <span class="shrink-0 text-[11px] tracking-wide text-stone-500 uppercase">{byline}</span>
  {/if}
</RowShell>
