<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { goto, preloadData, pushState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { PageData } from './$types';
  import RecordRow from '$lib/components/RecordRow.svelte';
  import RecordCard from '$lib/components/RecordCard.svelte';
  import RecordDetail from '$lib/components/RecordDetail.svelte';
  import TypeFilterTabs from './TypeFilterTabs.svelte';
  import Modal from './Modal.svelte';
  import * as m from '$lib/paraglide/messages.js';
  import { formatDate } from '$lib/utils/formatDate';
  import { recordListParams } from '$lib/records/listQuery';

  let { data }: { data: PageData } = $props();

  // Open a record in the detail modal via shallow routing — the URL becomes
  // /data/<id> (shareable, back-button closes), with the [id] load data
  // preloaded into page.state. Falls back to a real navigation on miss.
  async function openRecord(id: string) {
    const href = resolve('/(app)/data/[id]', { id }) + page.url.search;
    const result = await preloadData(href);
    if (result.type === 'loaded' && result.status === 200) {
      // href is resolve()-built but carries a query string, which the rule can't verify
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      pushState(href, { detail: result.data as App.PageState['detail'] });
    } else {
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(href);
    }
  }

  // The row's own link opens the modal; modified clicks keep their native
  // new-tab behaviour.
  function openLink(e: MouseEvent, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    openRecord(id);
  }

  // Mouse convenience: clicking the row body (outside its own links/buttons) opens
  // the record. Keyboard and assistive tech use the row's link instead.
  function openFromRow(e: MouseEvent, id: string) {
    const target = e.target;
    if (target instanceof Element && target.closest('a, button, input, textarea, select, label'))
      return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    openRecord(id);
  }

  // Accessible name for a row's open link: what the record is, not just "Open record".
  function openLabel(row: Row) {
    const what = [row.type.code, row.title ?? row.note ?? formatDate(row.createdAt)]
      .filter(Boolean)
      .join(' · ');
    return m.basic_mean_mongoose_pinch({ name: what });
  }

  function buildHref(overrides: Record<string, string | number | boolean | null>) {
    const url = new URL(page.url);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === '' || v === false) url.searchParams.delete(k);
      else url.searchParams.set(k, String(v));
    }
    return url.pathname + url.search;
  }

  // Repeating bento pattern: featured (2×2), wide (2×1), tall (1×2), normals.
  const bentoPattern = [
    'sm:col-span-2 sm:row-span-2',
    '',
    '',
    'sm:row-span-2',
    'sm:col-span-2',
    '',
    '',
    '',
  ];

  type Row = (typeof data.rows)[number];
  // svelte-ignore state_referenced_locally
  let rows = $state<Row[]>([...data.rows]);
  let nextPage = $state(2);
  let loading = $state(false);
  let failed = $state(false);
  // A fetch returned nothing new: the server has fewer rows than `total` said.
  let exhausted = $state(false);
  // Bumped when the list changes identity, so a response for the old list is dropped.
  let epoch = 0;
  let intersecting = $state(false);
  let sentinel = $state<HTMLDivElement | null>(null);

  // What makes this a different list (vs. the same list reloaded after a save).
  const listKey = $derived(
    JSON.stringify([
      data.typeFilter?.id,
      data.sort,
      data.includeDeleted,
      data.correspondentFilter,
      data.view,
    ]),
  );
  let loadedKey = '';

  // A filter/sort change starts over from the fresh first page; a reload of the
  // same list (e.g. after saving in the modal) keeps the pages already scrolled
  // in and just refreshes the rows the server returned again.
  $effect(() => {
    if (listKey !== loadedKey) {
      loadedKey = listKey;
      epoch += 1;
      rows = [...data.rows];
      nextPage = 2;
      failed = false;
      exhausted = false;
      loading = false;
    } else {
      const fresh = new Map(data.rows.map((r) => [r.id, r]));
      rows = untrack(() => rows).map((r) => fresh.get(r.id) ?? r);
      // The list may have grown since an empty page stopped loading; try again.
      exhausted = false;
    }
  });

  const hasMore = $derived(rows.length < data.total && !exhausted);

  async function loadMore() {
    if (loading || !hasMore) return;
    const mine = epoch;
    loading = true;
    failed = false;
    try {
      const params = recordListParams({
        page: nextPage,
        includeDeleted: data.includeDeleted,
        sort: data.sort === 'old' ? 'old' : 'new',
        typeId: data.typeFilter?.id ?? null,
        correspondent: data.correspondentFilter ?? null,
      });
      const res = await fetch(`/data/records?${params}`);
      if (mine !== epoch) return;
      if (res.status === 401) {
        await goto(resolve('/login'));
        return;
      }
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        failed = true;
        return;
      }
      const j = (await res.json()) as { rows: Row[] };
      if (mine !== epoch) return;
      // Offset paging can repeat a row if one was inserted meanwhile; keep ids unique.
      const seen = new Set(rows.map((r) => r.id));
      const fresh = j.rows.filter((r) => !seen.has(r.id));
      rows = [...rows, ...fresh];
      nextPage += 1;
      // Rows deleted since `total` was counted leave a gap that would refetch forever.
      if (j.rows.length === 0) exhausted = true;
    } catch {
      if (mine === epoch) failed = true;
    } finally {
      if (mine === epoch) loading = false;
    }
  }

  $effect(() => {
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        intersecting = !!entries[0]?.isIntersecting;
      },
      { rootMargin: '1200px' },
    );
    obs.observe(sentinel);
    return () => {
      obs.disconnect();
      intersecting = false;
    };
  });

  // Keep fetching while the sentinel is in view — guarantees a buffer of
  // off-screen rows even when the user scrolls past the trigger zone faster
  // than a single fetch can complete.
  $effect(() => {
    if (intersecting && hasMore && !loading && !failed) loadMore();
  });
</script>

{#snippet openable(row: Row, cls: string)}
  <!-- Clicking the row body is a mouse shortcut; the link below is the real,
       keyboard-reachable control (visible on focus) with a per-record name. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="relative cursor-pointer {cls}" onclick={(e) => openFromRow(e, row.id)}>
    {#if data.view === 'grid'}
      <RecordCard {row} type={row.type} />
    {:else}
      <RecordRow {row} type={row.type} />
    {/if}
    <!-- href is resolve()-built but the shallow-route click is intercepted above -->
    <!-- eslint-disable svelte/no-navigation-without-resolve -->
    <a
      href={resolve('/(app)/data/[id]', { id: row.id }) + page.url.search}
      aria-label={openLabel(row)}
      class="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-1 focus-visible:right-1 focus-visible:z-10 focus-visible:rounded focus-visible:bg-white focus-visible:px-2 focus-visible:py-0.5 focus-visible:text-xs focus-visible:shadow focus-visible:ring-2 focus-visible:ring-stone-400"
      onclick={(e) => openLink(e, row.id)}
    >
      {m.stock_tidy_scallop_nurture()}
    </a>
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  </div>
{/snippet}

<svelte:head><title>{m.tame_short_weasel_compose()}</title></svelte:head>

<div class="flex w-full flex-col gap-3 px-4 py-3 sm:px-6">
  <TypeFilterTabs
    options={data.typeOptions}
    activeId={data.typeFilter?.id ?? null}
    hrefFor={(id) => buildHref({ type: id, page: 1 })}
  />

  <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
    <span class="flex flex-wrap items-center gap-2">
      <span>{m.any_fun_sloth_list({ total: data.total })}</span>
      {#if data.correspondentFilter}
        <!-- href is the current route with a modified query string, which resolve() can't express -->
        <!-- eslint-disable svelte/no-navigation-without-resolve -->
        <a
          href={buildHref({ correspondent: null, page: 1 })}
          class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 hover:bg-amber-200"
          title={m.full_cute_chipmunk_amaze()}
        >
          <span class="font-hand text-sm leading-none">{data.correspondentFilter}</span>
          <span aria-hidden="true">×</span>
        </a>
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      {/if}
    </span>
    <div class="flex flex-wrap items-center gap-3">
      <!-- href is the current route with a modified query string, which resolve() can't express -->
      <!-- eslint-disable svelte/no-navigation-without-resolve -->
      <a
        href={buildHref({ sort: data.sort === 'old' ? null : 'old', page: 1 })}
        class="underline"
        title={m.fun_wise_vole_cry()}
      >
        {data.sort === 'old' ? m.raw_helpful_pelican_agree() : m.flaky_clear_hedgehog_snip()}
      </a>
      <a href={buildHref({ deleted: data.includeDeleted ? null : 1, page: 1 })} class="underline">
        {data.includeDeleted ? m.tangy_equal_ibex_scoop() : m.strong_nice_hare_enchant()}
      </a>
      <span class="inline-flex overflow-hidden rounded border border-stone-300">
        <a
          href={buildHref({ view: null, page: 1 })}
          class="px-2 py-0.5 {data.view === 'list'
            ? 'bg-stone-200 text-stone-800'
            : 'bg-white hover:bg-stone-50'}"
          aria-current={data.view === 'list' ? 'page' : undefined}
        >
          {m.patient_salty_hyena_comfort()}
        </a>
        <a
          href={buildHref({ view: 'grid', page: 1 })}
          class="border-l border-stone-300 px-2 py-0.5 {data.view === 'grid'
            ? 'bg-stone-200 text-stone-800'
            : 'bg-white hover:bg-stone-50'}"
          aria-current={data.view === 'grid' ? 'page' : undefined}
        >
          {m.candid_lower_oryx_arise()}
        </a>
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      </span>
    </div>
  </div>

  {#if data.view === 'grid'}
    <div
      class="grid grid-flow-row-dense auto-rows-[7rem] grid-cols-1 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10"
    >
      {#each rows as row, i (row.id)}
        <div class={['sm:col-span-2', bentoPattern[i % bentoPattern.length]]}>
          {@render openable(row, 'h-full rounded')}
        </div>
      {:else}
        <div class="col-span-full py-6 text-center text-sm text-stone-400">
          {m.long_red_puma_agree()}
        </div>
      {/each}
    </div>
  {:else}
    <div class="divide-y divide-stone-200 rounded border border-stone-200 bg-white">
      {#each rows as row (row.id)}
        {@render openable(row, 'hover:bg-stone-50')}
      {:else}
        <div class="px-2 py-6 text-center text-sm text-stone-400">{m.long_red_puma_agree()}</div>
      {/each}
    </div>
  {/if}

  <!-- The live region stays mounted so screen readers announce its changes. -->
  <div role="status">
    {#if hasMore}
      <div bind:this={sentinel} class="py-6 text-center text-xs text-stone-400">
        {#if failed}
          <span class="mr-2 text-red-700">{m.lazy_stale_frog_climb()}</span>
          <button type="button" class="underline" onclick={loadMore}>
            {m.short_chunky_zebra_offer()}
          </button>
        {:else}
          {loading ? m.curly_blue_mongoose_loop() : ''}
        {/if}
      </div>
    {:else if rows.length > 0}
      <div class="py-4 text-center text-xs text-stone-400">{m.jolly_nice_robin_fetch()}</div>
    {/if}
  </div>
</div>

{#if page.state.detail}
  <Modal onclose={() => history.back()}>
    <RecordDetail {...page.state.detail} onNavigate={openRecord} />
  </Modal>
{/if}
