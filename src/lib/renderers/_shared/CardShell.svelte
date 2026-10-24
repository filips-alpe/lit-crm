<script lang="ts">
  import type { Snippet } from 'svelte';
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import { formatDate } from '$lib/utils/formatDate';
  import type { RendererProps } from '$lib/render/props';
  import * as m from '$lib/paraglide/messages.js';

  // Outer frame for a full-bleed renderer card. Owns the universal chrome —
  // the creator + date meta corner and the deleted badge — so each renderer
  // only draws its distinctive body inside {@render children()}.
  let {
    creator,
    createdAt,
    status,
    bg,
    accent,
    meta = true,
    class: className,
    children,
  }: {
    creator: RendererProps['creator'];
    createdAt: RendererProps['createdAt'];
    status: string;
    bg?: string;
    /** Optional colored bar down the left edge. */
    accent?: string;
    /** Show the default creator + date corner. Set false to draw your own. */
    meta?: boolean;
    class?: string;
    children: Snippet;
  } = $props();

  const date = $derived(formatDate(createdAt));
</script>

<div
  class={[
    'relative flex h-full flex-col overflow-hidden rounded border border-stone-200',
    className,
  ]}
  style={bg ? `background:${bg}` : undefined}
>
  {#if accent}
    <span
      class="absolute top-0 bottom-0 left-0 z-10 w-1"
      style="background:{accent}"
      aria-hidden="true"
    ></span>
  {/if}

  {#if meta}
    <div class="pointer-events-none absolute top-1.5 right-2 z-10 flex items-center gap-1.5">
      {#if date}<span class="text-[10px] text-stone-500">{date}</span>{/if}
      {#if creator}<AvatarImage user={creator} class="size-6" />{/if}
    </div>
  {/if}

  {@render children()}

  {#if status !== 'ACTIVE'}
    <span
      class="absolute bottom-2 left-2 rounded bg-stone-200/90 px-1.5 py-0.5 text-[10px] text-stone-600"
      >{m.long_direct_rook_grace()}</span
    >
  {/if}
</div>
