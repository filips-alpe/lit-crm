<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText } from '$lib/render/select';
  import CardShell from '../_shared/CardShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const entries = $derived(Object.values(fields).filter((f) => f.value !== null));
  const headline = $derived(entries[0] ?? null);
  const rest = $derived(entries.slice(1));
</script>

<CardShell {creator} {createdAt} {status} accent={type.color}>
  <div class="flex h-full min-w-0 flex-col justify-center gap-1 p-3 pl-4">
    {#if headline}
      <span class="line-clamp-3 text-lg leading-tight font-bold text-stone-900">
        {asText(headline.value)}
      </span>
    {:else}
      <span class="text-stone-400">—</span>
    {/if}
    {#each rest as field, i (i)}
      <span class="truncate text-xs text-stone-500">{field.label}: {asText(field.value)}</span>
    {/each}
  </div>
</CardShell>
