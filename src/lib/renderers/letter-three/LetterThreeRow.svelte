<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { letterSummary } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const { correspondent, title: titleText } = $derived(letterSummary(fields));
</script>

<RowShell {creator} {createdAt} {status} class="bg-[#fafaf9]">
  <span class="h-3.5 w-1 shrink-0 rounded-full" style="background:{type.color}" aria-hidden="true"
  ></span>
  <span class="shrink-0 text-sm font-semibold text-stone-900">{correspondent ?? '—'}</span>
  {#if titleText}
    <span class="truncate text-xs text-stone-500">{titleText}</span>
  {/if}
</RowShell>
