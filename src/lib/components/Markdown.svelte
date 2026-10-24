<script lang="ts">
  import { renderMarkdown } from '$lib/utils/markdown';
  import * as m from '$lib/paraglide/messages.js';

  // Renders a Markdown string to nicely-formatted, safe HTML. The renderer
  // escapes the source before emitting any tags, so {@html} carries no injection
  // risk (see $lib/utils/markdown).
  let { source, class: className = '' }: { source: string | null | undefined; class?: string } =
    $props();

  const html = $derived(renderMarkdown(source));
</script>

<div class={['md', className]}>
  {#if html}
    <!-- eslint-disable-next-line svelte/no-at-html-tags — sanitised by renderMarkdown -->
    {@html html}
  {:else}
    <p class="text-sm text-stone-400 italic">{m.low_dizzy_polecat_support()}</p>
  {/if}
</div>

<style>
  .md :global(> :first-child) {
    margin-top: 0;
  }
  .md :global(> :last-child) {
    margin-bottom: 0;
  }
  .md :global(p) {
    margin: 0.75em 0;
    line-height: 1.7;
  }
  .md :global(h1),
  .md :global(h2),
  .md :global(h3) {
    margin: 1.1em 0 0.4em;
    font-weight: 600;
    line-height: 1.3;
    color: var(--color-stone-800);
  }
  .md :global(h1) {
    font-size: 1.35em;
  }
  .md :global(h2) {
    font-size: 1.2em;
  }
  .md :global(h3) {
    font-size: 1.05em;
  }
  .md :global(ul),
  .md :global(ol) {
    margin: 0.75em 0;
    padding-left: 1.4em;
  }
  .md :global(ul) {
    list-style: disc;
  }
  .md :global(ol) {
    list-style: decimal;
  }
  .md :global(li) {
    margin: 0.2em 0;
  }
  .md :global(blockquote) {
    margin: 0.9em 0;
    padding: 0.1em 0 0.1em 1em;
    border-left: 3px solid var(--color-stone-300);
    color: var(--color-stone-500);
    font-style: italic;
  }
  .md :global(a) {
    color: var(--color-violet-700);
    text-decoration: underline;
  }
  .md :global(code) {
    padding: 0.1em 0.3em;
    border-radius: 0.25rem;
    background: var(--color-stone-100);
    font-size: 0.9em;
  }
  .md :global(hr) {
    margin: 1.2em 0;
    border: none;
    border-top: 1px solid var(--color-stone-200);
  }
  .md :global(strong) {
    font-weight: 600;
  }
</style>
