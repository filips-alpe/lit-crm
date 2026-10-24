<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, present } from '$lib/render/select';
  import { calendarParts, formatTime } from '$lib/utils/formatDate';
  import CardShell from '../_shared/CardShell.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));
  const where = $derived(byWriteTo(fields, 'to'));
  const start = $derived(byWriteTo(fields, 'start'));
  const end = $derived(byWriteTo(fields, 'end'));
  const dateField = $derived(byWriteTo(fields, 'date') ?? start);

  const cal = $derived(calendarParts(dateField?.raw as Date | string | null | undefined));
  const timeRange = $derived.by(() => {
    const s = present(start) ? formatTime(start.raw as Date | string | null | undefined) : '';
    if (!s) return null;
    const e = present(end) ? formatTime(end.raw as Date | string | null | undefined) : '';
    return e ? `${s} – ${e}` : s;
  });
</script>

<CardShell {creator} {createdAt} {status}>
  <div class="flex h-full min-w-0">
    {#if cal}
      <div
        class="flex shrink-0 flex-col items-center justify-center border-r border-dashed border-stone-300 px-3"
      >
        <span class="text-[10px] font-semibold tracking-wide uppercase" style="color:{type.color}">
          {cal.month}
        </span>
        <span class="text-3xl leading-none font-bold text-stone-900">{cal.day}</span>
      </div>
    {/if}
    <div class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-3">
      {#if present(title)}
        <span class="line-clamp-2 text-sm font-semibold text-stone-800">{asText(title.value)}</span>
      {:else}
        <span class="text-sm text-stone-400">—</span>
      {/if}
      {#if present(where)}
        <span class="truncate text-xs text-stone-500">◦ {asText(where.value)}</span>
      {/if}
      {#if timeRange}
        <span class="text-xs text-stone-500 tabular-nums">{timeRange}</span>
      {/if}
    </div>
  </div>
</CardShell>
