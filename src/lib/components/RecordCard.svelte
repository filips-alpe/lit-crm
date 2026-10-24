<script lang="ts">
  import TypeBadge from './TypeBadge.svelte';
  import AvatarImage from './AvatarImage.svelte';
  import ProjectChips from './ProjectChips.svelte';
  import {
    buildRendererProps,
    presentFields,
    type RendererCreator,
    type RendererTypeInput,
  } from '$lib/render/props';
  import { getRenderer } from '$lib/renderers/registry';
  import { formatDate } from '$lib/utils/formatDate';
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

  const renderer = $derived(getRenderer(type.rendererId));
  const RendererCard = $derived(renderer?.card ?? null);
  const fullBleed = $derived(!!renderer?.fullBleed && !!RendererCard);
  const rendererProps = $derived(buildRendererProps(row, type));

  const rendered = $derived(presentFields(row, type));

  const dateLabel = $derived(formatDate(row.createdAt));
</script>

{#if fullBleed && RendererCard}
  <div class="relative h-full">
    <RendererCard {...rendererProps} />
    <ProjectChips
      projects={rendererProps.projects}
      class="pointer-events-none absolute bottom-1.5 left-1.5 z-20"
    />
  </div>
{:else}
  <div class="flex h-full flex-col overflow-hidden rounded border border-stone-200 bg-white">
    <div class="flex h-full flex-col gap-1.5 p-2.5">
      <div class="flex items-center gap-2">
        <TypeBadge
          code={type.code}
          color={type.color}
          iconSeed={type.iconSeed}
          class="size-7 shrink-0 rounded-lg"
        />
        {#if row.creator}
          <span title={row.creator.name} class="ml-auto shrink-0">
            <AvatarImage user={row.creator} class="size-8" />
          </span>
        {/if}
        <span class={['text-xs text-stone-500', !row.creator && 'ml-auto']}>{dateLabel}</span>
      </div>

      <div class="flex flex-col gap-0.5 text-sm">
        {#if RendererCard}
          <RendererCard {...rendererProps} />
        {:else if rendered.length === 0}
          <span class="truncate text-stone-400">{row.note ?? '—'}</span>
        {:else}
          {#each rendered as field (field.id)}
            <div class="flex flex-wrap items-baseline gap-1">
              <span class="text-[10px] tracking-wide text-stone-500 uppercase">{field.label}</span>
              {#if Array.isArray(field.value)}
                {#each field.value as item, i (i)}
                  <span class="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700"
                    >{item}</span
                  >
                {/each}
              {:else}
                <span class="text-stone-800">{field.value}</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <ProjectChips projects={rendererProps.projects} class="mt-auto pt-1" />

      {#if row.status !== 'ACTIVE'}
        <span class="self-start rounded bg-stone-200 px-1.5 py-0.5 text-xs text-stone-600"
          >{m.long_direct_rook_grace()}</span
        >
      {/if}
    </div>
  </div>
{/if}
