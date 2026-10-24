<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, letterSummary, present } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';
  import PersonChip from '../_shared/PersonChip.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));

  const { outgoing, correspondent } = $derived(letterSummary(fields));
</script>

<RowShell {creator} {createdAt} {status} class="bg-[#f5f0e6]">
  <svg
    class="size-4 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke={type.color}
    stroke-width="1.6"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
    <path d="M3.5 6.5 L12 13 L20.5 6.5" />
  </svg>
  <span class="shrink-0 text-[11px] tracking-widest text-stone-400 uppercase">
    {outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}
  </span>
  {#if correspondent}
    <PersonChip name={correspondent} color={type.color} class="shrink-0" />
  {:else}
    <span class="font-hand text-lg text-stone-400">—</span>
  {/if}
  {#if present(title)}
    <span class="truncate text-stone-600">{asText(title.value)}</span>
  {/if}
</RowShell>
