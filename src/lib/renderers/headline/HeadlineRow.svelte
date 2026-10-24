<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const entries = $derived(Object.values(fields).filter((f) => f.value !== null));
  const headline = $derived(entries[0] ?? null);
  const rest = $derived(entries.slice(1));
</script>

<RowShell {creator} {createdAt} {status}>
  <span class="h-4 w-1 shrink-0 rounded" style="background:{type.color}" aria-hidden="true"></span>
  {#if headline}
    <span class="truncate font-semibold text-stone-900">{asText(headline.value)}</span>
  {:else}
    <span class="text-stone-400">—</span>
  {/if}
  {#each rest as field, i (i)}
    <span class="shrink-0 text-xs text-stone-500">{field.label}: {asText(field.value)}</span>
  {/each}
</RowShell>
