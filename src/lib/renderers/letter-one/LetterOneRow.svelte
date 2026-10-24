<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { letterSummary } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const { outgoing, correspondent, title: titleText } = $derived(letterSummary(fields));
</script>

<RowShell {creator} {createdAt} {status} class="bg-[#fffdf7]">
  <span
    class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-white uppercase"
    style="background:{type.color}"
    >{outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}</span
  >
  <span class="shrink-0 font-hand text-base text-stone-800">{correspondent ?? '—'}</span>
  {#if titleText}
    <span class="truncate text-stone-500">{titleText}</span>
  {/if}
</RowShell>
