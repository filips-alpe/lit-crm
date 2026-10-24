<script lang="ts">
  // A pull-quote: serif italic text with an attribution line.
  let {
    text,
    by,
    source,
    class: className,
  }: { text: string; by?: string; source?: string; class?: string } = $props();
</script>

<blockquote class={['border-l-2 border-amber-600 pl-4', className]}>
  <p class="font-serif text-lg leading-snug text-stone-800 italic">&ldquo;{text}&rdquo;</p>
  {#if by || source}
    <footer class="mt-1.5 text-xs text-stone-500">
      {#if by}<span class="font-medium text-stone-600">{by}</span>{/if}{#if by && source},
      {/if}{#if source}<cite>{source}</cite>{/if}
    </footer>
  {/if}
</blockquote>
