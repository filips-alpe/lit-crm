<script lang="ts">
  import { resolve } from '$app/paths';
  import type { RecordRef } from '$lib/bestPage/assemble';
  import * as m from '$lib/paraglide/messages.js';

  let { ref, count }: { ref: RecordRef; count?: number } = $props();
</script>

<a
  href={resolve('/(app)/page/[id]', { id: ref.id })}
  class="inline-flex items-baseline gap-1.5 rounded px-1.5 py-0.5 text-sm hover:bg-stone-100"
>
  <span class="size-2 shrink-0 self-center rounded-full" style="background-color: {ref.typeColor}"
  ></span>
  <span class="text-stone-900 underline decoration-stone-300 underline-offset-2"
    >{ref.title ?? m.large_brief_cobra_laugh()}</span
  >
  {#if count !== undefined}<span class="text-xs text-stone-500 tabular-nums">{count}</span>{/if}
</a>
