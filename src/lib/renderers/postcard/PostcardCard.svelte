<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, letterSummary, present } from '$lib/render/select';
  import { formatDate } from '$lib/utils/formatDate';
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import CardShell from '../_shared/CardShell.svelte';
  import PersonChip from '../_shared/PersonChip.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));

  const { outgoing, correspondent } = $derived(letterSummary(fields));
  const date = $derived(formatDate(createdAt));
</script>

<!-- Postcard: the picture-side of a holiday card, not an envelope. A double-
     ruled border, a postage stamp pressed into the corner, a big handwritten
     greeting, and a single addressee along the foot. -->
<CardShell {creator} {createdAt} {status} meta={false} bg="#f5edda" class="border-amber-200/70">
  <div class="relative flex h-full flex-col p-3">
    <span
      class="pointer-events-none absolute inset-1.5 rounded-[2px] border border-amber-300/50"
      aria-hidden="true"
    ></span>

    <!-- Wordmark + the sender as a postmarked stamp. -->
    <div class="relative flex items-start justify-between gap-2">
      <span class="mt-1 text-[8px] font-semibold tracking-[0.25em] text-amber-800/45 uppercase">
        {m.left_male_kitten_pull()}
      </span>
      <div class="flex items-start gap-1">
        {#if date}<span class="mt-1 text-[9px] text-amber-800/40">{date}</span>{/if}
        <div
          class="rotate-3 rounded-[1px] border border-dashed bg-white/60 p-0.5"
          style="border-color:{type.color}90"
        >
          {#if creator}
            <AvatarImage user={creator} class="size-7" />
          {:else}
            <span
              class="flex size-7 items-center justify-center text-xs font-bold text-white"
              style="background:{type.color}"
            >
              {type.code.slice(0, 1).toUpperCase()}
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Handwritten greeting. -->
    <p class="relative my-2 line-clamp-2 font-hand text-xl leading-tight text-stone-700">
      {#if present(title)}{asText(title.value)}{:else}—{/if}
    </p>

    <!-- Addressee along the foot. -->
    <div
      class="relative mt-auto flex min-w-0 items-center gap-1.5 border-t border-amber-300/40 pt-1.5"
    >
      <span class="shrink-0 text-[9px] tracking-widest text-amber-800/45 uppercase">
        {outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}
      </span>
      {#if correspondent}
        <PersonChip name={correspondent} color={type.color} compact class="min-w-0" />
      {:else}
        <span class="font-hand text-lg text-stone-400">—</span>
      {/if}
    </div>
  </div>
</CardShell>
