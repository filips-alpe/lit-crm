<script lang="ts">
  import { resolve } from '$app/paths';
  import { segmentText, type MentionSpan } from '$lib/records/mentionSegments';

  // A record's text with its mentions turned into links to the entity pages. The text is shown
  // exactly as stored (never through markdown) in one pre-wrap block, so paragraph breaks are the
  // text's own newlines and the DOM's textContent equals `text`.
  let { text, mentions = [] }: { text: string; mentions?: MentionSpan[] } = $props();

  const segments = $derived(segmentText(text, mentions));
</script>

<div class="annotated-text text-base leading-relaxed text-stone-800">
  {#each segments as seg, i (i)}
    {#if seg.kind === 'link'}
      <a
        href={resolve('/(app)/entity/[id]', { id: seg.entityId })}
        class="text-sky-800 underline decoration-sky-300 decoration-dotted underline-offset-2 hover:decoration-solid"
        >{seg.text}</a
      >
    {:else}
      {seg.text}
    {/if}
  {/each}
</div>

<style>
  /* The text's own newlines and spacing are its layout; do not rely on a utility class for it. */
  .annotated-text {
    white-space: pre-wrap;
  }
</style>
