<script lang="ts">
  import type { Snippet } from 'svelte';
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import { formatDate } from '$lib/utils/formatDate';
  import type { RendererProps } from '$lib/render/props';
  import * as m from '$lib/paraglide/messages.js';

  // Outer strip for a full-bleed renderer row. Owns the trailing creator +
  // date cluster and the deleted badge; the renderer draws its inline body.
  let {
    creator,
    createdAt,
    status,
    class: className,
    children,
  }: {
    creator: RendererProps['creator'];
    createdAt: RendererProps['createdAt'];
    status: string;
    class?: string;
    children: Snippet;
  } = $props();

  const date = $derived(formatDate(createdAt));
</script>

<div class={['flex items-center gap-2 bg-white px-3 py-1.5', className]}>
  <div class="flex min-w-0 flex-1 items-center gap-2">
    {@render children()}
    {#if status !== 'ACTIVE'}
      <span class="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] text-stone-600"
        >{m.long_direct_rook_grace()}</span
      >
    {/if}
  </div>
  {#if creator}<AvatarImage user={creator} class="size-7 shrink-0" />{/if}
  {#if date}<span class="shrink-0 text-xs text-stone-500">{date}</span>{/if}
</div>
