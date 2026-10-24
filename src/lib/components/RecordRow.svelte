<script lang="ts">
  import TypeBadge from './TypeBadge.svelte';
  import AvatarImage from './AvatarImage.svelte';
  import ProjectChips from './ProjectChips.svelte';
  import type { RendererCreator, RendererTypeInput } from '$lib/render/props';
  import { recordView } from '$lib/render/recordView';
  import * as m from '$lib/paraglide/messages.js';

  let {
    row,
    type,
  }: {
    row: Record<string, unknown> & {
      id: string;
      createdAt: Date | string;
      status: string;
      creator?: RendererCreator | null;
    };
    type: RendererTypeInput;
  } = $props();

  const {
    Renderer: RendererRow,
    fullBleed,
    rendererProps,
    rendered,
    dateLabel,
  } = $derived(recordView(row, type, 'row'));
</script>

{#if fullBleed && RendererRow}
  {#if rendererProps.projects.length}
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1"><RendererRow {...rendererProps} /></div>
      <ProjectChips projects={rendererProps.projects} class="shrink-0 pr-3" />
    </div>
  {:else}
    <RendererRow {...rendererProps} />
  {/if}
{:else}
  <div class="flex items-start gap-2 bg-white px-3 py-1">
    <TypeBadge
      code={type.code}
      color={type.color}
      iconSeed={type.iconSeed}
      class="mt-0.5 size-5 shrink-0 rounded-md"
    />

    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      {#if RendererRow}
        <RendererRow {...rendererProps} />
      {:else if rendered.length === 0}
        <span class="text-stone-400">{row.note ?? '—'}</span>
      {:else}
        {#each rendered as field (field.id)}
          <span class="inline-flex flex-wrap items-baseline gap-1">
            <span class="text-xs tracking-wide text-stone-500 uppercase">{field.label}</span>
            {#if Array.isArray(field.value)}
              {#each field.value as item, i (i)}
                <span class="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">{item}</span
                >
              {/each}
            {:else}
              <span class="text-stone-800">{field.value}</span>
            {/if}
          </span>
        {/each}
      {/if}

      {#if row.status !== 'ACTIVE'}
        <span class="rounded bg-stone-200 px-1.5 py-0.5 text-xs text-stone-600"
          >{m.long_direct_rook_grace()}</span
        >
      {/if}
    </div>

    <ProjectChips projects={rendererProps.projects} class="shrink-0" />

    {#if row.creator}
      <span title={row.creator.name} class="shrink-0">
        <AvatarImage user={row.creator} class="size-8" />
      </span>
    {/if}

    <div class="shrink-0 text-xs text-stone-500">{dateLabel}</div>
  </div>
{/if}
