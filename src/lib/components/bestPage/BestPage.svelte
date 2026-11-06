<script lang="ts">
  import { resolve } from '$app/paths';
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import MentionText from './MentionText.svelte';
  import RecordLink from './RecordLink.svelte';
  import type { BestPage, FactValue } from '$lib/bestPage/assemble';
  import { formatDate } from '$lib/utils/formatDate';
  import * as m from '$lib/paraglide/messages.js';

  // One page for every record. The sections and their order come from the
  // data (see $lib/bestPage/assemble.ts); this component only knows how to draw
  // each kind of section, never a particular type or entity.
  let { page }: { page: BestPage } = $props();

  const isUrl = (s: string) => /^https?:\/\//.test(s);
  const factText = (v: FactValue): string =>
    v.kind === 'date'
      ? formatDate(v.value)
      : v.kind === 'number'
        ? String(v.value)
        : v.kind === 'text' || v.kind === 'person'
          ? v.value
          : '';
</script>

<article class="flex flex-col gap-6" data-record={page.record.id}>
  <header class="flex items-start gap-3">
    <TypeBadge
      code={page.record.typeCode}
      color={page.record.typeColor}
      iconSeed={page.record.typeIconSeed}
      class="size-10 shrink-0 rounded-xl"
    />
    <div class="min-w-0 flex-1">
      <p class="text-xs font-medium tracking-wide text-stone-500 uppercase">
        {page.record.typeCode}{#if page.record.date}
          · {formatDate(page.record.date)}{/if}
      </p>
      <h1 class="font-serif text-2xl text-stone-900">
        {page.record.title ?? m.large_brief_cobra_laugh()}
      </h1>
    </div>
    <a
      href={resolve('/(app)/data/[id]', { id: page.record.id })}
      class="shrink-0 text-sm text-stone-500 underline hover:text-stone-800"
      >{m.away_smart_lark_drop()}</a
    >
  </header>

  {#each page.sections as section (section.kind)}
    <section class="flex flex-col gap-2" data-section={section.kind}>
      {#if section.kind === 'facts'}
        <h2 class="text-sm font-semibold text-stone-600">{m.helpful_equal_raven_sway()}</h2>
        <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {#each section.facts as fact (fact.label)}
            <dt class="text-stone-500">{fact.label}</dt>
            <dd class="text-stone-900">
              {#if fact.value.kind === 'list'}
                <ul>
                  {#each fact.value.value as item (item)}
                    <li>
                      {#if isUrl(item)}<a
                          href={item}
                          rel="external noopener"
                          target="_blank"
                          class="break-all underline">{item}</a
                        >{:else}{item}{/if}
                    </li>
                  {/each}
                </ul>
              {:else if fact.value.kind === 'record'}
                <RecordLink ref={fact.value.value} />
              {:else}
                {factText(fact.value)}
              {/if}
            </dd>
          {/each}
        </dl>
      {:else if section.kind === 'text'}
        <h2 class="text-sm font-semibold text-stone-600">{section.label}</h2>
        <div class="rounded border border-stone-200 bg-white p-4 sm:p-6">
          <MentionText segments={section.segments} />
        </div>
      {:else if section.kind === 'mentioned'}
        <h2 class="text-sm font-semibold text-stone-600">{m.north_good_sloth_gasp()}</h2>
        <div class="flex flex-wrap gap-1">
          {#each section.entities as entity (entity.id)}
            <RecordLink ref={entity} count={entity.count} />
          {/each}
        </div>
      {:else if section.kind === 'mentions'}
        <h2 class="text-sm font-semibold text-stone-600">
          {m.pretty_dark_earthworm_emerge()}
          <span class="font-normal text-stone-500"
            >· {m.strong_white_starfish_treat({
              count: section.total,
              records: section.groups.length + section.more,
            })}</span
          >
        </h2>
        <ol class="flex flex-col gap-3">
          {#each section.groups as group (group.source.id)}
            <li class="rounded border border-stone-200 bg-white p-3">
              <div class="flex items-baseline justify-between gap-2">
                <RecordLink ref={group.source} />
                <span class="text-xs text-stone-500 tabular-nums">{group.count}×</span>
              </div>
              <ul class="mt-1 flex flex-col gap-1 pl-1.5">
                {#each group.contexts as ctx, i (i)}
                  <li class="font-serif text-sm text-stone-700">
                    {ctx.before}<mark class="bg-amber-100 text-stone-900">{ctx.match}</mark
                    >{ctx.after}
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ol>
        {#if section.more}
          <p class="text-sm text-stone-500">{m.weak_lost_bird_list({ count: section.more })}</p>
        {/if}
      {:else if section.kind === 'related'}
        <h2 class="text-sm font-semibold text-stone-600">{m.weird_ideal_sparrow_nourish()}</h2>
        <div class="flex flex-wrap gap-1">
          {#each section.entities as entity (entity.id)}
            <RecordLink ref={entity} count={entity.count} />
          {/each}
        </div>
      {:else if section.kind === 'linked'}
        <h2 class="text-sm font-semibold text-stone-600">{m.lazy_day_mouse_read()}</h2>
        <div class="flex flex-wrap gap-1">
          {#if section.parent}<RecordLink ref={section.parent} />{/if}
          {#each section.children as child (child.id)}
            <RecordLink ref={child} />
          {/each}
        </div>
      {:else if section.kind === 'sources'}
        <h2 class="text-sm font-semibold text-stone-600">{m.plain_clear_swan_strive()}</h2>
        <ul class="text-sm">
          {#each section.references as ref (ref)}
            <li>
              {#if isUrl(ref)}<a
                  href={ref}
                  rel="external noopener"
                  target="_blank"
                  class="break-all text-stone-700 underline">{ref}</a
                >{:else}{ref}{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
</article>
