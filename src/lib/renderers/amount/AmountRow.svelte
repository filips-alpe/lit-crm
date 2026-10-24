<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, firstByWriteTo, present } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const amount = $derived(firstByWriteTo(fields, ['sum', 'total']));
  const title = $derived(byWriteTo(fields, 'title'));
  const to = $derived(byWriteTo(fields, 'to'));
  const from = $derived(byWriteTo(fields, 'from'));
  const counterparty = $derived(
    present(to) ? `→ ${asText(to.value)}` : present(from) ? `← ${asText(from.value)}` : null,
  );
</script>

<RowShell {creator} {createdAt} {status}>
  <span class="size-2.5 shrink-0 rounded-full" style="background:{type.color}" aria-hidden="true"
  ></span>
  {#if present(amount)}
    <span class="shrink-0 font-semibold text-stone-900 tabular-nums">{asText(amount.value)}</span>
  {/if}
  {#if present(title)}
    <span class="truncate text-stone-700">{asText(title.value)}</span>
  {:else if !present(amount)}
    <span class="text-stone-400">—</span>
  {/if}
  {#if counterparty}
    <span class="shrink-0 text-xs text-stone-500">{counterparty}</span>
  {/if}
</RowShell>
