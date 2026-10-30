<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { letterSummary } from '$lib/render/select';
  import { formatDate } from '$lib/utils/formatDate';
  import CardShell from '../_shared/CardShell.svelte';
  import PersonChip from '../_shared/PersonChip.svelte';

  // Redesign Four — "Ticket Stub": a perforated boarding-pass stub holds an
  // envelope mark; the main column carries the meta, correspondent and subject
  // as separate rows. The stub is its own flex column, so it never sits on text.
  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const { outgoing, correspondent, title: titleText } = $derived(letterSummary(fields));
  const date = $derived(formatDate(createdAt));
</script>

<CardShell {creator} {createdAt} {status} meta={false} bg="#ffffff" class="border-stone-300">
  <div class="flex h-full min-h-0">
    <div
      class="flex w-11 shrink-0 items-center justify-center border-r border-dashed"
      style="background:{type.color}14;border-color:{type.color}66"
    >
      <svg
        class="size-5"
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
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-center gap-1 px-2.5 py-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[9px] tracking-widest text-stone-400 uppercase"
          >{outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}</span
        >
        {#if date}<span class="shrink-0 text-[9px] text-stone-400">{date}</span>{/if}
      </div>
      {#if correspondent}
        <PersonChip name={correspondent} color={type.color} class="min-w-0" />
      {:else}
        <span class="font-hand text-lg text-stone-400">—</span>
      {/if}
      {#if titleText}
        <span class="line-clamp-2 text-xs text-stone-500">{titleText}</span>
      {/if}
    </div>
  </div>
</CardShell>
