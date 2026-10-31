<script lang="ts">
  import DetailShell from '../_shared/DetailShell.svelte';
  import RecordField from '$lib/components/RecordField.svelte';
  import AnnotatedText from '$lib/components/AnnotatedText.svelte';
  import { byWriteTo } from '$lib/render/select';
  import type { RendererDetailProps } from '$lib/render/props';
  import * as m from '$lib/paraglide/messages.js';

  // Detail for a record that carries source text: title, date, the text with its entity mentions
  // linked, and the references, read-only, with the type's editable fields folded underneath.
  // The read view uses the saved values, so an unsaved edit never shifts the mention offsets.
  let { sf, layout, fields, record, mentions = [] }: RendererDetailProps = $props();

  const title = $derived(byWriteTo(fields, 'title')?.value);
  const date = $derived(byWriteTo(fields, 'date')?.value);
  const rawText = $derived(byWriteTo(fields, 'text')?.raw);
  const text = $derived(typeof rawText === 'string' ? rawText : '');
  const rawRefs = $derived(byWriteTo(fields, 'references')?.raw);
  const references = $derived(Array.isArray(rawRefs) ? (rawRefs as string[]) : []);
</script>

<DetailShell {sf} {record}>
  <div class="flex flex-col gap-4">
    {#if title}
      <h1 class="text-2xl font-semibold text-stone-900">{title}</h1>
    {/if}
    {#if date}
      <p class="text-sm text-stone-500">{date}</p>
    {/if}
    {#if text}
      <AnnotatedText {text} {mentions} />
    {/if}
    {#if references.length}
      <section class="flex flex-col gap-1 border-t border-stone-200 pt-3">
        <h2 class="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          {m.sweet_shy_flamingo_embrace()}
        </h2>
        <ul class="list-disc pl-5 text-sm break-words text-stone-600">
          {#each references as ref, i (i)}<li>{ref}</li>{/each}
        </ul>
      </section>
    {/if}
  </div>

  <details class="border-t border-stone-200 pt-3">
    <summary class="cursor-pointer text-sm text-stone-600">{m.icy_least_anteater_hike()}</summary>
    <div class="mt-3 flex flex-col gap-4">
      {#each layout.fields as field (field.id)}
        <RecordField {sf} {field} />
      {/each}
    </div>
  </details>
</DetailShell>
