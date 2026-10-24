<script lang="ts">
  import type { Snippet } from 'svelte';

  // A titled panel — the standard frame for every dashboard widget.
  let {
    title,
    subtitle,
    aside,
    class: className,
    children,
  }: {
    title?: string;
    subtitle?: string;
    /** Optional right-aligned header content (a link, a count). */
    aside?: Snippet;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<section class={['rounded-lg border border-stone-200 bg-white', className]}>
  {#if title || aside}
    <header class="flex items-baseline justify-between gap-2 border-b border-stone-100 px-4 py-2.5">
      <div class="min-w-0">
        {#if title}<h2 class="truncate text-sm font-semibold text-stone-800">{title}</h2>{/if}
        {#if subtitle}<p class="truncate text-xs text-stone-500">{subtitle}</p>{/if}
      </div>
      {#if aside}<div class="shrink-0 text-xs text-stone-500">{@render aside()}</div>{/if}
    </header>
  {/if}
  <div class="p-4">{@render children()}</div>
</section>
