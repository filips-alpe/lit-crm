<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { letterSummary } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const { outgoing, correspondent, title: titleText } = $derived(letterSummary(fields));
</script>

<RowShell {creator} {createdAt} {status} class="bg-[#f7f7f8]">
  <span
    class="max-w-[55%] min-w-0 truncate rounded-full px-2 py-0.5 text-xs {outgoing
      ? 'text-white'
      : 'border border-stone-200 bg-white text-stone-700'}"
    style={outgoing ? `background:${type.color}` : undefined}
  >
    {titleText || '…'}
  </span>
  <span class="shrink-0 text-[10px] text-stone-500">
    {outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}
    {correspondent ?? '—'}
  </span>
</RowShell>
