<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, present } from '$lib/render/select';
  import { calendarParts } from '$lib/utils/formatDate';
  import RowShell from '../_shared/RowShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));
  const where = $derived(byWriteTo(fields, 'to'));
  const start = $derived(byWriteTo(fields, 'start'));
  const dateField = $derived(byWriteTo(fields, 'date') ?? start);

  const cal = $derived(calendarParts(dateField?.raw as Date | string | null | undefined));
</script>

<RowShell {creator} {createdAt} {status}>
  {#if cal}
    <span
      class="flex shrink-0 items-baseline gap-0.5 rounded px-1 text-stone-700"
      style="background:{type.color}1a"
    >
      <span class="text-sm font-bold tabular-nums">{cal.day}</span>
      <span class="text-[10px] uppercase">{cal.month}</span>
    </span>
  {/if}
  {#if present(title)}
    <span class="truncate font-medium text-stone-800">{asText(title.value)}</span>
  {:else}
    <span class="text-stone-400">—</span>
  {/if}
  {#if present(where)}
    <span class="shrink-0 text-xs text-stone-500">◦ {asText(where.value)}</span>
  {/if}
</RowShell>
