<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, firstByWriteTo, present } from '$lib/render/select';
  import CardShell from '../_shared/CardShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const amount = $derived(firstByWriteTo(fields, ['sum', 'total']));
  const unit = $derived(byWriteTo(fields, 'unit'));
  const title = $derived(byWriteTo(fields, 'title'));
  const to = $derived(byWriteTo(fields, 'to'));
  const from = $derived(byWriteTo(fields, 'from'));
  const counterparty = $derived(
    present(to) ? `→ ${asText(to.value)}` : present(from) ? `← ${asText(from.value)}` : null,
  );
</script>

<CardShell {creator} {createdAt} {status} accent={type.color}>
  <div class="flex h-full min-w-0 flex-col gap-0.5 p-3 pl-4">
    {#if present(amount)}
      <span class="truncate text-2xl leading-tight font-semibold text-stone-900 tabular-nums">
        {asText(amount.value)}
      </span>
      {#if present(unit)}
        <span class="text-[10px] text-stone-400"
          >{m.mean_same_leopard_yell({ unit: asText(unit.value) })}</span
        >
      {/if}
      {#if present(title)}
        <span class="mt-0.5 truncate text-sm text-stone-600">{asText(title.value)}</span>
      {/if}
    {:else if present(title)}
      <span class="truncate text-base font-semibold text-stone-800">{asText(title.value)}</span>
    {:else}
      <span class="text-sm text-stone-400">—</span>
    {/if}

    {#if counterparty}
      <span class="truncate text-xs text-stone-500">{counterparty}</span>
    {/if}
  </div>
</CardShell>
