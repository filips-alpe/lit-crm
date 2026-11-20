<script lang="ts">
  import type { HistoryEntry, HistoryPage } from '$lib/history/types';
  import { historyColumnLabel, historyValue } from '$lib/history/format';
  import * as m from '$lib/paraglide/messages.js';

  let {
    recordId,
    history,
    layout,
  }: {
    recordId: string;
    history: HistoryPage;
    layout: { fields: { label: string; writeTo: string }[] };
  } = $props();

  // The page the load shipped, then older pages appended as they are asked for. The record
  // page re-mounts this panel per record, so the first page is only read once.
  // svelte-ignore state_referenced_locally
  let entries = $state<HistoryEntry[]>(history.entries);
  // svelte-ignore state_referenced_locally
  let nextBefore = $state<string | null>(history.nextBefore);
  let loading = $state(false);
  let failed = $state(false);

  async function loadMore() {
    if (loading || !nextBefore) return;
    loading = true;
    failed = false;
    try {
      const res = await fetch(`/data/${encodeURIComponent(recordId)}/history?before=${nextBefore}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as HistoryPage;
      const seen = new Set(entries.map((e) => e.id));
      entries = [...entries, ...page.entries.filter((e) => !seen.has(e.id))];
      nextBefore = page.nextBefore;
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }

  const empty = $derived(m.legal_tired_pelican_love());
  const labels = (cols: string[]) => cols.map((c) => historyColumnLabel(c, layout)).join(', ');

  function summary(e: HistoryEntry): string {
    const actor = e.actorName ?? m.home_keen_blackbird_strive();
    if (e.kind === 'link') {
      const project = e.projectCode ?? '';
      return e.action === 'DELETE'
        ? m.arable_same_penguin_wave({ actor, project })
        : m.novel_many_mole_adapt({ actor, project });
    }
    switch (e.action) {
      case 'INSERT':
        return m.ago_trite_pelican_pull({ actor });
      case 'DELETE':
        return m.even_brave_vole_startle({ actor });
      case 'REDACT':
        return m.cuddly_dirty_opossum_boost({ actor, fields: labels(e.changed) });
      default:
        return m.nice_cuddly_seal_jolt({ actor, fields: labels(e.changed) });
    }
  }
</script>

<section class="mt-6" aria-labelledby="record-history-heading" data-testid="record-history">
  <h2 id="record-history-heading" class="text-sm font-semibold text-stone-700">
    {m.alert_many_koala_promise()}
  </h2>
  {#if entries.length === 0}
    <p class="mt-2 text-sm text-stone-500">{m.proud_gray_tern_pet()}</p>
  {:else}
    <ol class="mt-2 divide-y divide-stone-200 rounded border border-stone-200 bg-white">
      {#each entries as e (e.id)}
        <li class="px-3 py-2 text-sm" data-action={e.action} data-kind={e.kind}>
          <div class="flex flex-wrap items-baseline justify-between gap-x-3">
            <span class="text-stone-800">{summary(e)}</span>
            <time class="text-xs text-stone-500" datetime={e.at}>
              {new Date(e.at).toLocaleString()}
            </time>
          </div>
          {#if e.action === 'UPDATE' && e.kind === 'record'}
            <dl class="mt-1 text-xs text-stone-600">
              {#each Object.entries(e.values) as [col, value] (col)}
                <div class="flex gap-2">
                  <dt class="font-medium">{historyColumnLabel(col, layout)}</dt>
                  <dd class="min-w-0 break-words">{historyValue(value, empty)}</dd>
                </div>
              {/each}
            </dl>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
  {#if nextBefore}
    <button
      type="button"
      class="mt-2 text-sm text-stone-600 underline hover:text-stone-900 disabled:opacity-50"
      disabled={loading}
      onclick={loadMore}
      data-testid="history-more"
    >
      {m.pretty_few_mayfly_engage()}
    </button>
  {/if}
  {#if failed}
    <p class="mt-1 text-sm text-red-700" role="alert">{m.wild_away_javelina_cherish()}</p>
  {/if}
</section>
