<script lang="ts">
  import { resolve } from '$app/paths';
  import type { TextSegment } from '$lib/bestPage/assemble';

  // The record's text exactly as stored; a segment that names an entity becomes
  // a link to that entity's page. Paragraph breaks are kept by `pre-wrap`.
  let { segments }: { segments: TextSegment[] } = $props();
</script>

<div class="font-serif text-[15px] leading-relaxed whitespace-pre-wrap text-stone-800">
  {#each segments as segment, i (i)}{#if segment.entityId}<a
        href={resolve('/(app)/page/[id]', { id: segment.entityId })}
        title={segment.entityTitle}
        data-entity={segment.entityId}
        class="text-inherit underline decoration-sky-600/50 decoration-1 underline-offset-2 hover:bg-sky-50 hover:decoration-sky-700"
        >{segment.text}</a
      >{:else}{segment.text}{/if}{/each}
</div>
