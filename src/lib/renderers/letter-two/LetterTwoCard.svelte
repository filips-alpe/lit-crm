<script lang="ts">
  import { readableTextColor } from '$lib/utils/contrast';
  import type { RendererProps } from '$lib/render/props';
  import { textOf } from '$lib/render/select';
  import CardShell from '../_shared/CardShell.svelte';
  import * as m from '$lib/paraglide/messages.js';

  // Redesign Two — "Routing": two equal zones, sender on the left and recipient
  // on the right, joined by an arrow, with the subject on a strip beneath. Each
  // zone truncates independently so the two names never collide.
  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const fromText = $derived(textOf(fields, 'from') ?? '');
  const toText = $derived(textOf(fields, 'to') ?? '');
  const titleText = $derived(textOf(fields, 'title') ?? '');
</script>

<CardShell {creator} {createdAt} {status} meta={false} bg="#ffffff" class="border-stone-300">
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex min-h-0 flex-1 items-stretch">
      <div class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-2">
        <span class="text-[9px] tracking-widest text-stone-400 uppercase"
          >{m.nice_game_dingo_support()}</span
        >
        <span class="truncate text-sm font-medium text-stone-800">{fromText || '—'}</span>
      </div>
      <div class="flex shrink-0 items-center px-1">
        <span
          class="grid size-6 place-items-center rounded-full text-xs"
          style="background:{type.color}; color:{readableTextColor(type.color)}">→</span
        >
      </div>
      <div class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-2 text-right">
        <span class="text-[9px] tracking-widest text-stone-400 uppercase"
          >{m.safe_deft_orangutan_trust()}</span
        >
        <span class="truncate text-sm font-medium text-stone-800">{toText || '—'}</span>
      </div>
    </div>

    {#if titleText}
      <div
        class="truncate border-t px-2.5 py-1 text-xs text-stone-500"
        style="border-color:{type.color}33"
      >
        {titleText}
      </div>
    {/if}
  </div>
</CardShell>
