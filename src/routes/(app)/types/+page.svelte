<script lang="ts">
  import { resolve } from '$app/paths';
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import type { PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{m.quiet_pink_parrot_clasp()}</title></svelte:head>

<h2 class="my-3 text-center text-lg font-semibold">{m.quiet_pink_parrot_clasp()}</h2>

<div class="mx-auto w-full max-w-[820px] px-3 sm:px-4">
  <ul id="TypesList" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <li class="col-span-full">
      <a
        href={resolve('/(app)/types/new')}
        class="group/add relative flex h-full min-h-[108px] items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-stone-300 bg-white px-6 py-6 text-sm font-medium text-stone-700 transition-colors duration-300 hover:border-solid hover:border-emerald-300 hover:text-emerald-900"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-gradient-to-r from-emerald-50 via-emerald-100 to-emerald-50 transition-transform duration-500 ease-out group-hover/add:scale-x-100"
        ></span>
        <span
          aria-hidden="true"
          class="relative flex size-9 items-center justify-center rounded-full bg-emerald-100 text-base text-emerald-700 ring-1 ring-emerald-200 transition group-hover/add:bg-emerald-600 group-hover/add:text-white"
        >
          +
        </span>
        <span class="relative">{m.sour_gross_jellyfish_stab()}</span>
      </a>
    </li>

    {#each data.rows as row (row.id)}
      {@const deleted = row.status === 'INACTIVE'}
      <li>
        <a
          id={`type-${row.id}`}
          href={resolve('/(app)/types/[id]', { id: row.id })}
          class={[
            'flex h-full items-stretch overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-px hover:shadow-md',
            deleted ? 'border-stone-200 bg-white text-stone-400 line-through' : 'tinted-card',
          ]}
          style:--card-bg={deleted ? undefined : `${row.color}10`}
          style:--card-bg-hover={deleted ? undefined : `${row.color}22`}
          style:--card-border={deleted ? undefined : `${row.color}33`}
          style:--card-border-hover={deleted ? undefined : `${row.color}66`}
        >
          <div
            class="flex w-16 shrink-0 items-center justify-center self-stretch"
            style:background-color={row.color}
            style:opacity={deleted ? 0.4 : undefined}
          >
            <TypeBadge
              code={row.code}
              color={row.color}
              iconSeed={row.iconSeed}
              class="size-10 rounded-none"
            />
          </div>
          <div class="flex min-h-[64px] min-w-0 flex-1 flex-col justify-center px-4 py-3">
            <div class="flex items-center gap-2">
              <div class="truncate text-sm font-semibold">{row.code}</div>
              {#if deleted}
                <span class="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600"
                  >{m.long_direct_rook_grace()}</span
                >
              {/if}
            </div>
            {#if row.description}
              <div class="truncate text-xs text-stone-500">{row.description}</div>
            {/if}
          </div>
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .tinted-card {
    background-color: var(--card-bg);
    border-color: var(--card-border);
  }
  .tinted-card:hover {
    background-color: var(--card-bg-hover);
    border-color: var(--card-border-hover);
  }
</style>
