<script lang="ts">
  import { readableTextColor } from '$lib/utils/contrast';
  import type { RendererProjectChip } from '$lib/render/props';

  // Read-only project membership chips for cards/rows. Renders nothing when the
  // record belongs to no project.
  let { projects, class: className = '' }: { projects: RendererProjectChip[]; class?: string } =
    $props();
</script>

{#if projects.length}
  <div class={['flex flex-wrap gap-1', className]}>
    {#each projects as p (p.id)}
      <span
        class="rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium"
        style="background-color: {p.color}; color: {readableTextColor(p.color)}"
        title={p.code}
      >
        {p.code}
      </span>
    {/each}
  </div>
{/if}
