<script lang="ts">
  import { readableTextColor } from '$lib/utils/contrast';
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { letterSummary } from '$lib/render/select';
  import { formatDate } from '$lib/utils/formatDate';
  import CardShell from '../_shared/CardShell.svelte';

  // Redesign One — "Index Card": a library catalogue card. A coloured tab row
  // (direction + correspondent + date) sits above ruled body lines. Everything
  // lives in normal flow with truncation, so nothing can overlap.
  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const { outgoing, correspondent, title: titleText } = $derived(letterSummary(fields));
  const date = $derived(formatDate(createdAt));
</script>

<CardShell {creator} {createdAt} {status} meta={false} bg="#fffdf7" class="border-stone-300">
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center gap-2 border-b-2 px-2.5 py-1.5" style="border-color:{type.color}">
      <span
        class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-widest uppercase"
        style="background:{type.color}; color:{readableTextColor(type.color)}"
        >{outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}</span
      >
      <span class="min-w-0 flex-1 truncate font-hand text-base leading-none text-stone-800">
        {correspondent ?? '—'}
      </span>
      {#if date}<span class="shrink-0 text-[9px] text-stone-400">{date}</span>{/if}
    </div>

    <div
      class="min-h-0 flex-1 overflow-hidden px-2.5 py-1.5"
      style="background-image:repeating-linear-gradient(#0000 0 19px, {type.color}1a 19px 20px)"
    >
      {#if titleText}
        <p class="line-clamp-3 text-sm leading-5 text-stone-700">{titleText}</p>
      {:else}
        <p class="text-sm leading-5 text-stone-300 italic">{m.clear_teary_mouse_dart()}</p>
      {/if}
    </div>
  </div>
</CardShell>
