<script lang="ts">
  import type { HistoryEntry, HistoryPage } from '$lib/history/types';
  import { historyColumnLabel, historyValue } from '$lib/history/format';
  import * as m from '$lib/paraglide/messages.js';

  let {
    history,
    layout,
  }: {
    history: HistoryPage;
    layout: { fields: { label: string; writeTo: string }[] };
  } = $props();

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
  {#if history.entries.length === 0}
    <p class="mt-2 text-sm text-stone-500">{m.proud_gray_tern_pet()}</p>
  {:else}
    <ol class="mt-2 divide-y divide-stone-200 rounded border border-stone-200 bg-white">
      {#each history.entries as e (e.id)}
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
</section>
