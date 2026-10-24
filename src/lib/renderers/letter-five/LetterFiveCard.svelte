<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { letterSummary } from '$lib/render/select';
  import { formatDate } from '$lib/utils/formatDate';
  import CardShell from '../_shared/CardShell.svelte';

  // Redesign Five — "Conversation": the letter as a chat bubble. The subject
  // sits inside the bubble; the correspondent + date sit on a separate line
  // beneath it. Outgoing letters align right, incoming left.
  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const { outgoing, correspondent, title: titleText } = $derived(letterSummary(fields));
  const date = $derived(formatDate(createdAt));
</script>

<CardShell {creator} {createdAt} {status} meta={false} bg="#f7f7f8" class="border-stone-200">
  <div
    class="flex h-full min-h-0 flex-col justify-center gap-1.5 p-2.5 {outgoing
      ? 'items-end'
      : 'items-start'}"
  >
    <div
      class="max-w-[88%] rounded-2xl px-3 py-2 text-sm {outgoing
        ? 'rounded-br-sm text-white'
        : 'rounded-bl-sm border border-stone-200 bg-white text-stone-800'}"
      style={outgoing ? `background:${type.color}` : undefined}
    >
      <p class="line-clamp-3 leading-snug">{titleText || '…'}</p>
    </div>
    <div class="flex items-center gap-1.5 px-1 {outgoing ? 'flex-row-reverse' : ''}">
      <span class="truncate text-[10px] text-stone-500">
        {outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}
        {correspondent ?? '—'}
      </span>
      {#if date}<span class="shrink-0 text-[9px] text-stone-400">· {date}</span>{/if}
    </div>
  </div>
</CardShell>
