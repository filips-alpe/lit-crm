<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { textOf } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const fromText = $derived(textOf(fields, 'from') ?? '');
  const toText = $derived(textOf(fields, 'to') ?? '');
  const titleText = $derived(textOf(fields, 'title') ?? '');
</script>

<RowShell {creator} {createdAt} {status} class="bg-white">
  <span class="max-w-[35%] min-w-0 truncate text-sm font-medium text-stone-800"
    >{fromText || '—'}</span
  >
  <span class="shrink-0 text-xs" style="color:{type.color}">→</span>
  <span class="max-w-[35%] min-w-0 truncate text-sm font-medium text-stone-800"
    >{toText || '—'}</span
  >
  {#if titleText}
    <span class="truncate text-xs text-stone-500">{titleText}</span>
  {/if}
</RowShell>
