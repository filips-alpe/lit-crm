<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { letterSummary } from '$lib/render/select';
  import { formatDate } from '$lib/utils/formatDate';
  import CardShell from '../_shared/CardShell.svelte';

  // Redesign Three — "Swiss": disciplined typography. A short accent rule, a
  // small meta label, a large correspondent name, then the subject. Generous
  // spacing and clamping keep it airy and collision-free.
  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const { outgoing, correspondent, title: titleText } = $derived(letterSummary(fields));
  const date = $derived(formatDate(createdAt));
</script>

<CardShell {creator} {createdAt} {status} meta={false} bg="#fafaf9" class="border-stone-200">
  <div class="flex h-full min-h-0 flex-col gap-1 p-3">
    <span class="h-1 w-8 shrink-0 rounded-full" style="background:{type.color}" aria-hidden="true"
    ></span>
    <span class="truncate text-[9px] font-medium tracking-[0.2em] text-stone-400 uppercase">
      {outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}{date
        ? ` · ${date}`
        : ''}
    </span>
    <span class="truncate text-lg leading-tight font-semibold text-stone-900">
      {correspondent ?? '—'}
    </span>
    {#if titleText}
      <p class="line-clamp-2 min-h-0 text-xs leading-snug text-stone-500">{titleText}</p>
    {/if}
  </div>
</CardShell>
