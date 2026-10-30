<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, present } from '$lib/render/select';
  import { formatDate } from '$lib/utils/formatDate';
  import CardShell from '../_shared/CardShell.svelte';
  import Party from '../_shared/Party.svelte';
  import { resolveParties } from '../_shared/parties';
  import * as m from '$lib/paraglide/messages.js';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));
  const parties = $derived(resolveParties(fields, creator?.name ?? null));
  const date = $derived(formatDate(createdAt));
</script>

<!-- Air Mail: a flight itinerary, not an envelope. A dashed flight path on the
     left rail runs from the sender's stop down to the recipient's, a plane
     mid-route; the correspondents and subject read off to the side. -->
<CardShell {creator} {createdAt} {status} meta={false} bg="#f1f6fc" class="border-sky-100">
  <div class="relative flex h-full gap-3 p-3">
    <!-- Flight rail: two stops joined by a dashed path, a plane mid-route. -->
    <div class="relative flex w-3 shrink-0 flex-col items-center justify-between py-1">
      <span
        class="absolute top-1.5 bottom-1.5 w-px border-l border-dashed"
        style="border-color:{type.color}66"
        aria-hidden="true"
      ></span>
      <span class="relative size-2 rounded-full" style="background:{type.color}"></span>
      <span
        class="relative rotate-[135deg] text-[11px] leading-none"
        style="color:{type.color}"
        aria-hidden="true">✈</span
      >
      <span class="relative size-2 rounded-full border-2 bg-white" style="border-color:{type.color}"
      ></span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[8px] font-semibold tracking-[0.25em] text-sky-700/50 uppercase">
          {m.bright_alive_ray_boil()}
        </span>
        {#if date}<span class="text-[9px] text-sky-700/40">{date}</span>{/if}
      </div>

      <div
        class="mt-auto flex min-w-0 flex-col gap-1.5"
        title={asText(title?.value ?? null) || undefined}
      >
        {#if parties.sender}
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="w-7 shrink-0 text-[9px] tracking-widest text-sky-700/45 uppercase"
              >{m.nice_game_dingo_support()}</span
            >
            <Party
              name={parties.sender.name}
              external={parties.sender.external}
              color={type.color}
              account={creator}
              compact
              class="min-w-0"
            />
          </div>
        {/if}
        {#if parties.recipient}
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="w-7 shrink-0 text-[9px] tracking-widest text-sky-700/45 uppercase"
              >{m.soft_spicy_toucan_ripple()}</span
            >
            <Party
              name={parties.recipient.name}
              external={parties.recipient.external}
              color={type.color}
              account={creator}
              compact
              class="min-w-0"
            />
          </div>
        {/if}
        {#if present(title)}
          <span class="truncate text-[10px] text-sky-900/45 italic">{asText(title.value)}</span>
        {/if}
      </div>
    </div>
  </div>
</CardShell>
