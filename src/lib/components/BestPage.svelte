<script lang="ts">
  import { resolve } from '$app/paths';
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import type { BestPageSection } from '$lib/records/bestPage';
  import * as m from '$lib/paraglide/messages.js';

  // The best page of any record, assembled from whichever sections the record has data for (see
  // bestPageSections). It renders the sections it is given and never looks at what the record is.
  let {
    recordId,
    title,
    type,
    sections,
  }: {
    recordId: string;
    title: string | null;
    type: { code: string; color: string; iconSeed: string | null };
    sections: BestPageSection[];
  } = $props();

  const heading = 'text-sm font-semibold tracking-wide text-stone-600 uppercase';
  const link = 'text-stone-800 underline decoration-stone-300 hover:decoration-stone-800';

  const pageHref = (n: number) => `${resolve('/(app)/entity/[id]', { id: recordId })}?page=${n}`;
</script>

<article class="flex flex-col gap-6" data-testid="best-page">
  <header class="flex items-center gap-3 border-b border-stone-200 pb-3">
    <TypeBadge
      code={type.code}
      color={type.color}
      iconSeed={type.iconSeed}
      decorative
      class="size-12 shrink-0 rounded-lg"
    />
    <div class="flex min-w-0 flex-col">
      <span class="text-xs text-stone-500">{type.code}</span>
      <h1 class="text-2xl font-semibold text-stone-900">
        {title ?? m.bold_livid_crossbill_conquer()}
      </h1>
    </div>
    <a href={resolve('/(app)/data/[id]', { id: recordId })} class="ml-auto shrink-0 text-sm {link}"
      >{m.bright_free_dolphin_scold()}</a
    >
  </header>

  {#each sections as section (section.kind)}
    {#if section.kind === 'fields'}
      <section data-section="fields" class="flex flex-col gap-2">
        <h2 class={heading}>{m.broad_fine_puffin_cook()}</h2>
        <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {#each section.fields as field (field.id)}
            <dt class="text-stone-500">{field.label}</dt>
            <dd class="text-stone-800">
              {#if Array.isArray(field.value)}
                <ul class="list-disc pl-4">
                  {#each field.value as v, i (i)}<li>{v}</li>{/each}
                </ul>
              {:else}
                {field.value}
              {/if}
            </dd>
          {/each}
        </dl>
      </section>
    {:else if section.kind === 'references'}
      <section data-section="references" class="flex flex-col gap-2">
        <h2 class={heading}>{m.sweet_shy_flamingo_embrace()}</h2>
        <ul class="list-disc pl-5 text-sm text-stone-700">
          {#each section.references as ref, i (i)}<li class="break-words">{ref}</li>{/each}
        </ul>
      </section>
    {:else if section.kind === 'variants'}
      <section data-section="variants" class="flex flex-col gap-2">
        <h2 class={heading}>{m.noisy_heavy_opossum_create()}</h2>
        <ul class="flex flex-wrap gap-2 text-sm">
          {#each section.variants as v (v.surface)}
            <li class="rounded bg-stone-100 px-2 py-0.5 text-stone-800">
              {v.surface}
              <span class="text-xs text-stone-500"
                >{m.plain_quick_shrike_praise({ count: v.count })}</span
              >
            </li>
          {/each}
        </ul>
      </section>
    {:else if section.kind === 'mentions'}
      <section data-section="mentions" class="flex flex-col gap-2">
        <h2 class={heading}>{m.gaudy_merry_warthog_empower({ total: section.total })}</h2>
        <ul class="flex flex-col gap-3">
          {#each section.items as item, i (`${item.recordId}:${item.start}:${i}`)}
            <li class="text-sm">
              <a href={resolve('/(app)/data/[id]', { id: item.recordId })} class={link}
                >{item.recordTitle ?? m.bold_livid_crossbill_conquer()}</a
              >
              <span class="text-xs text-stone-500">{item.typeCode}</span>
              <p class="mt-0.5 text-stone-600">
                …{item.before}<mark class="bg-amber-100 text-stone-900">{item.surface}</mark
                >{item.after}…
              </p>
            </li>
          {/each}
        </ul>
        {#if section.totalPages > 1}
          <nav aria-label={m.jumpy_mild_okapi_enjoy()} class="flex items-center gap-4 text-sm">
            {#if section.page > 1}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={pageHref(section.page - 1)} rel="prev" class={link}
                >{m.zany_watery_liger_create()}</a
              >
            {/if}
            <span class="text-stone-500"
              >{m.left_grassy_stork_clasp({ page: section.page, total: section.totalPages })}</span
            >
            {#if section.page < section.totalPages}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={pageHref(section.page + 1)} rel="next" class={link}
                >{m.pretty_slimy_grebe_skip()}</a
              >
            {/if}
          </nav>
        {/if}
      </section>
    {:else if section.kind === 'sources' || section.kind === 'related' || section.kind === 'mentioned'}
      <section data-section={section.kind} class="flex flex-col gap-2">
        <h2 class={heading}>
          {#if section.kind === 'sources'}
            {m.tangy_jumpy_alpaca_thrive()}
          {:else if section.kind === 'related'}
            {m.topical_cuddly_shrike_cook()}
          {:else}
            {m.fresh_mellow_alpaca_scoop()}
          {/if}
        </h2>
        <ul class="flex flex-col gap-1 text-sm">
          {#each section.records as r (r.id)}
            <li>
              {#if section.kind === 'sources'}
                <a href={resolve('/(app)/data/[id]', { id: r.id })} class={link}
                  >{r.title ?? m.bold_livid_crossbill_conquer()}</a
                >
              {:else}
                <a href={resolve('/(app)/entity/[id]', { id: r.id })} class={link}
                  >{r.title ?? m.bold_livid_crossbill_conquer()}</a
                >
              {/if}
              <span class="text-xs text-stone-500">{r.typeCode}</span>
              <span class="text-xs text-stone-500"
                >{m.plain_quick_shrike_praise({ count: r.count })}</span
              >
            </li>
          {/each}
        </ul>
      </section>
    {:else if section.kind === 'sequence'}
      <section data-section="sequence" class="flex flex-col gap-2">
        <h2 class={heading}>{m.close_that_turkey_push()}</h2>
        <nav class="flex items-center justify-between gap-4 text-sm">
          {#if section.prev}
            <a href={resolve('/(app)/entity/[id]', { id: section.prev.id })} rel="prev" class={link}
              >← {m.sharp_red_squid_nail()}: {section.prev.title ??
                m.bold_livid_crossbill_conquer()}</a
            >
          {:else}
            <span></span>
          {/if}
          <span class="text-stone-500"
            >{m.same_weary_frog_type({ position: section.position, total: section.total })}</span
          >
          {#if section.next}
            <a href={resolve('/(app)/entity/[id]', { id: section.next.id })} rel="next" class={link}
              >{m.plain_merry_leopard_mop()}: {section.next.title ??
                m.bold_livid_crossbill_conquer()} →</a
            >
          {:else}
            <span></span>
          {/if}
        </nav>
      </section>
    {/if}
  {/each}
</article>
