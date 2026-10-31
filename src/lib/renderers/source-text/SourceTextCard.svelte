<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText } from '$lib/render/select';
  import CardShell from '../_shared/CardShell.svelte';

  // Card for a record that carries source text: the title leads, the opening of the text follows.
  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const entries = $derived(Object.values(fields));
  const title = $derived(entries.find((f) => f.writeTo === 'title' && f.value !== null) ?? null);
  const excerpt = $derived(
    entries.find((f) => f.writeTo === 'text' && typeof f.raw === 'string' && f.raw !== ''),
  );
</script>

<CardShell {creator} {createdAt} {status} accent={type.color}>
  <div class="flex h-full min-w-0 flex-col justify-center gap-1 p-3 pl-4">
    {#if title}
      <span class="line-clamp-2 text-lg leading-tight font-bold text-stone-900">
        {asText(title.value)}
      </span>
    {:else}
      <span class="text-stone-400">—</span>
    {/if}
    {#if excerpt}
      <span class="line-clamp-3 text-xs text-stone-500">{String(excerpt.raw).slice(0, 300)}</span>
    {/if}
  </div>
</CardShell>
