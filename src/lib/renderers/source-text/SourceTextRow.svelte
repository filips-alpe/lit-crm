<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const entries = $derived(Object.values(fields));
  const title = $derived(entries.find((f) => f.writeTo === 'title' && f.value !== null) ?? null);
  const excerpt = $derived(
    entries.find((f) => f.writeTo === 'text' && typeof f.raw === 'string' && f.raw !== ''),
  );
</script>

<RowShell {creator} {createdAt} {status}>
  <span class="h-4 w-1 shrink-0 rounded" style="background:{type.color}" aria-hidden="true"></span>
  {#if title}
    <span class="shrink-0 font-semibold text-stone-900">{asText(title.value)}</span>
  {:else}
    <span class="text-stone-400">—</span>
  {/if}
  {#if excerpt}
    <span class="truncate text-xs text-stone-500">{String(excerpt.raw).slice(0, 160)}</span>
  {/if}
</RowShell>
