<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, letterSummary, present, textOf } from '$lib/render/select';
  import { parseLatLng } from '$lib/fields/registry';
  import { formatDate } from '$lib/utils/formatDate';
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import CardShell from '../_shared/CardShell.svelte';
  import PersonChip from '../_shared/PersonChip.svelte';
  import RouteThumb from '../_shared/RouteThumb.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));

  const { outgoing, correspondent, title: titleText } = $derived(letterSummary(fields));
  const date = $derived(formatDate(createdAt));

  // Map view: drawn whenever at least one endpoint carries parseable coordinates.
  const fromPoint = $derived(parseLatLng(byWriteTo(fields, 'fromGeo')?.raw));
  const toPoint = $derived(parseLatLng(byWriteTo(fields, 'toGeo')?.raw));
  const hasRoute = $derived(fromPoint !== null || toPoint !== null);

  const fromText = $derived(textOf(fields, 'from') ?? '');
  const toText = $derived(textOf(fields, 'to') ?? '');
  const routeCaption = $derived(
    fromText && toText ? `${fromText} → ${toText}` : fromText || toText,
  );
</script>

<CardShell {creator} {createdAt} {status} meta={false} bg="#f5f0e6" class="border-stone-300/80">
  {#if hasRoute}
    <div class="relative h-full w-full overflow-hidden">
      <RouteThumb from={fromPoint} to={toPoint} color={type.color} />
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent p-2 pt-5"
      >
        <div class="flex min-w-0 flex-col">
          {#if routeCaption}
            <span class="truncate text-[11px] font-medium text-white">{routeCaption}</span>
          {/if}
          {#if titleText}
            <span class="truncate text-[10px] text-white/80">{titleText}</span>
          {/if}
        </div>
        {#if date}
          <span class="shrink-0 text-[9px] whitespace-nowrap text-white/70">{date}</span>
        {/if}
      </div>
    </div>
  {:else}
    <div class="relative flex h-full flex-col p-3">
      <!-- Envelope flap + seams, drawn over the paper. -->
      <svg
        class="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 200 130"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 0 L100 74 L200 0 Z" fill="#0000000a" />
        <path
          d="M0 0 L100 74 L200 0 M0 130 L72 62 M200 130 L128 62"
          fill="none"
          stroke="#00000022"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <!-- Postage stamp (the sender as the portrait) + postmark. -->
      <div class="relative flex items-start justify-end gap-1">
        {#if date}
          <span class="mt-1 -rotate-6 text-[9px] tracking-wide text-stone-400">{date}</span>
        {/if}
        <div
          class="rotate-3 rounded-[2px] border border-dashed p-0.5"
          style="border-color:{type.color}80; background:{type.color}14"
        >
          {#if creator}
            <AvatarImage user={creator} class="size-7" />
          {:else}
            <span
              class="flex size-7 items-center justify-center rounded-[1px] text-xs font-bold text-white"
              style="background:{type.color}"
            >
              {type.code.slice(0, 1).toUpperCase()}
            </span>
          {/if}
        </div>
      </div>

      <!-- Handwritten address. -->
      <div class="relative mt-auto flex min-w-0 flex-col gap-0.5">
        <span class="font-display text-[10px] tracking-widest text-stone-400 uppercase">
          {outgoing ? m.safe_deft_orangutan_trust() : m.nice_game_dingo_support()}
        </span>
        {#if correspondent}
          <PersonChip name={correspondent} color={type.color} class="min-w-0" />
        {:else}
          <span class="font-hand text-xl text-stone-400">—</span>
        {/if}
        {#if present(title)}
          <span
            class="mt-0.5 line-clamp-2 border-t border-stone-300/70 pt-1 text-xs text-stone-600"
          >
            {asText(title.value)}
          </span>
        {/if}
      </div>
    </div>
  {/if}
</CardShell>
