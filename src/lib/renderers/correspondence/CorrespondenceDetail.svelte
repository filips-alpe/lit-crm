<script lang="ts">
  import * as Form from 'formsnap';
  import { resolve } from '$app/paths';
  import DetailShell from '../_shared/DetailShell.svelte';
  import CorrespondenceMap from '../_shared/CorrespondenceMap.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import RecordField from '$lib/components/RecordField.svelte';
  import { parseLatLng } from '$lib/fields/registry';
  import { textOf } from '$lib/render/select';
  import type { RendererDetailProps } from '$lib/render/props';
  import type { LayoutField } from '$lib/forms/layout';
  import * as m from '$lib/paraglide/messages.js';

  // The letter detail leads with the letter itself: subject and full body are the
  // main content. Below, a map of the whole correspondence — every located letter
  // drawn as a path, this one highlighted, the others clickable to open — sits
  // beside the editable endpoints and their coordinates. A thread bar navigates
  // the stack of letters between these same two people.
  let { sf, layout, fields, record, thread, letters, onNavigate }: RendererDetailProps = $props();

  // svelte-ignore state_referenced_locally
  const { form: formData } = sf;

  // Columns this layout places by hand; anything else is rendered generically below.
  const PLACED = ['title', 'text', 'creatorId', 'from', 'fromGeo', 'assigneeId', 'to', 'toGeo'];
  const field = (col: string): LayoutField | undefined =>
    layout.fields.find((f) => f.writeTo === col);

  const titleF = $derived(field('title'));
  const textF = $derived(field('text'));
  const extras = $derived(layout.fields.filter((f) => !PLACED.includes(f.writeTo)));

  // This letter's own route, parsed from the live form so the map redraws as the
  // coordinates are edited.
  const liveFrom = $derived(parseLatLng($formData.fromGeo));
  const liveTo = $derived(parseLatLng($formData.toGeo));

  // Thread caption / current route label from the saved endpoints.
  const fromName = $derived(textOf(fields, 'from') ?? '?');
  const toName = $derived(textOf(fields, 'to') ?? '?');

  const routeLabel = (from: string | null, to: string | null): string =>
    `${from?.trim() || '?'} → ${to?.trim() || '?'}`;

  // Every located letter as a route. The current letter uses the live form points
  // and is appended last so it draws on top; siblings with no parseable endpoint
  // are dropped.
  const routes = $derived.by(() => {
    const others = letters
      .filter((l) => l.id !== record.id)
      .map((l) => ({
        id: l.id,
        from: parseLatLng(l.fromGeo),
        to: parseLatLng(l.toGeo),
        label: routeLabel(l.from, l.to),
      }))
      .filter((r) => r.from !== null || r.to !== null);
    const current =
      liveFrom !== null || liveTo !== null
        ? [{ id: record.id, from: liveFrom, to: liveTo, label: routeLabel(fromName, toName) }]
        : [];
    return [...others, ...current];
  });

  const otherCount = $derived(routes.filter((r) => r.id !== record.id).length);
  const hasMap = $derived(routes.length > 0);
</script>

<DetailShell {sf} {record}>
  {#if thread.total > 1}
    <nav
      class="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
    >
      <span class="min-w-0 truncate text-stone-600">
        {m.just_lucky_vole_kiss()} <span class="font-medium text-stone-800">{fromName}</span>
        ↔ <span class="font-medium text-stone-800">{toName}</span>
      </span>
      <span class="flex shrink-0 items-center gap-3">
        {@render threadLink(thread.prevId, m.lime_dark_millipede_relish())}
        <span class="text-xs text-stone-500"
          >{m.lower_vivid_jackdaw_imagine({ position: thread.position, total: thread.total })}</span
        >
        {@render threadLink(thread.nextId, m.red_maroon_mammoth_reap())}
      </span>
    </nav>
  {/if}

  <!-- Main content: the letter. Subject, then the body — written in Markdown,
       shown formatted, with the source tucked into a disclosure to edit. -->
  <div class="flex flex-col gap-3">
    {#if titleF}<RecordField {sf} field={titleF} />{/if}
    {#if textF}
      <div class="flex flex-col gap-2">
        <Markdown
          source={typeof $formData.text === 'string' ? $formData.text : ''}
          class="rounded border border-stone-200 bg-white px-5 py-4 text-stone-800"
        />
        <Form.Field form={sf} name="text">
          <Form.Control>
            {#snippet children({ props })}
              <details class="text-sm">
                <summary class="cursor-pointer text-stone-500 hover:text-stone-700">
                  {m.less_spare_felix_startle({ label: textF.label.toLowerCase() })}
                </summary>
                <textarea
                  {...props}
                  rows="16"
                  value={typeof $formData.text === 'string' ? $formData.text : ''}
                  oninput={(e) => (($formData.text as unknown) = e.currentTarget.value)}
                  class="mt-2 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm leading-relaxed"
                ></textarea>
              </details>
            {/snippet}
          </Form.Control>
        </Form.Field>
      </div>
    {/if}
  </div>

  <!-- The correspondence map and this letter's endpoints. -->
  <div class="grid gap-5 border-t border-stone-200 pt-4 sm:grid-cols-2">
    <div class="flex flex-col gap-4">
      {#each ['creatorId', 'from', 'fromGeo', 'assigneeId', 'to', 'toGeo'] as col (col)}
        {@const f = field(col)}
        {#if f}<RecordField {sf} field={f} />{/if}
      {/each}
    </div>

    <div class="flex flex-col gap-2">
      <div class="aspect-[4/3] w-full overflow-hidden rounded border border-stone-200 bg-stone-50">
        {#if hasMap}
          <CorrespondenceMap
            letters={routes}
            currentId={record.id}
            color={record.type.color}
            onSelect={onNavigate}
          />
        {:else}
          <div
            class="flex h-full items-center justify-center px-3 text-center text-xs text-stone-400"
          >
            {m.active_mushy_toucan_sing()}
          </div>
        {/if}
      </div>
      {#if otherCount > 0}
        <p class="text-xs text-stone-500">
          {m.salty_large_buzzard_renew({ count: otherCount })}
        </p>
      {/if}
    </div>
  </div>

  {#if extras.length}
    <div class="flex flex-col gap-4 border-t border-stone-200 pt-4">
      {#each extras as f (f.id)}
        <RecordField {sf} field={f} />
      {/each}
    </div>
  {/if}
</DetailShell>

<!-- Prev/next within the correspondence: a button that flips the modal in place
     when onNavigate is supplied, else a plain link to the letter's page. -->
{#snippet threadLink(id: string | null, label: string)}
  {#if id}
    {#if onNavigate}
      <button
        type="button"
        class="text-stone-600 underline hover:text-stone-900"
        onclick={() => onNavigate?.(id)}>{label}</button
      >
    {:else}
      <a
        href={resolve('/(app)/data/[id]', { id })}
        class="text-stone-600 underline hover:text-stone-900">{label}</a
      >
    {/if}
  {:else}
    <span class="text-stone-300">{label}</span>
  {/if}
{/snippet}
