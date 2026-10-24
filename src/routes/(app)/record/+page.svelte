<script lang="ts">
  import { page } from '$app/state';
  import RecordForm from './RecordForm.svelte';
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import { resolve } from '$app/paths';
  import type { PageData, LayoutData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data }: { data: PageData & LayoutData } = $props();

  function hrefFor(id: string) {
    const url = new URL(page.url);
    url.searchParams.set('type', id);
    return url.pathname + url.search;
  }
</script>

<svelte:head><title>{m.gaudy_silly_grizzly_spark()}</title></svelte:head>

<h2 class="my-3 text-center text-lg font-semibold">{m.gaudy_silly_grizzly_spark()}</h2>

<div class="mx-auto w-full max-w-3xl px-3 sm:px-0">
  <div class="mb-2 text-xs font-medium text-stone-600">{m.vexed_nimble_puffin_wave()}</div>
  {#if data.types.length === 0}
    <p
      class="rounded border border-stone-200 bg-white px-3 py-4 text-center text-sm text-stone-500"
    >
      {m.deft_left_slug_grin()}
      <a href={resolve('/(app)/types')} class="underline">{m.odd_due_puffin_hunt()}</a>
      {m.drab_wise_rat_transform()}
    </p>
  {:else}
    <!-- hrefs are the current route with a modified query string, which resolve() can't express -->
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <ul class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
      {#each data.types as t (t.id)}
        {@const selected = t.id === data.typeId}
        <li>
          <a
            href={hrefFor(t.id)}
            class={[
              'flex flex-col items-center gap-1 rounded-md border p-2 text-center transition hover:bg-stone-50',
              selected ? 'border-stone-800 ring-2 ring-stone-300' : 'border-stone-200',
            ]}
            title={t.description ?? t.code}
            aria-current={selected ? 'true' : undefined}
          >
            <TypeBadge
              code={t.code}
              color={t.color}
              iconSeed={t.iconSeed}
              class="size-12 rounded-xl"
            />
            <span class="truncate text-xs font-medium">{t.code}</span>
          </a>
        </li>
      {/each}
    </ul>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  {/if}
</div>

{#if data.form && data.layout && data.typeId}
  <!-- Same route for every ?type=, so key the form: its options context and superForm are one-shot. -->
  {#key data.typeId}
    <RecordForm form={data.form} layout={data.layout} typeId={data.typeId} options={data.options} />
  {/key}
{:else}
  <p class="mx-auto mt-6 max-w-[545px] px-3 text-center text-sm text-stone-500 sm:px-0">
    {m.lazy_mean_bird_tear()}
  </p>
{/if}
