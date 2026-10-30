<script lang="ts">
  import { superForm, type SuperValidated } from 'sveltekit-superforms';
  import { getRenderer } from '$lib/renderers/registry';
  import GenericDetail from '$lib/renderers/_shared/GenericDetail.svelte';
  import {
    buildRendererDetailProps,
    type RendererCreator,
    type RendererDetailMapLetter,
    type RendererDetailThread,
    type RendererTypeInput,
  } from '$lib/render/props';
  import type { FormLayout } from '$lib/forms/layout';
  import { setRecordOptions, type RecordFormOptions } from '$lib/forms/recordOptions';

  const EMPTY_OPTIONS: RecordFormOptions = { users: [], records: [], projects: [] };

  let {
    record,
    type,
    form,
    layout,
    thread,
    letters = [],
    options = EMPTY_OPTIONS,
    onNavigate,
  }: {
    record: Record<string, unknown> & {
      id: string;
      createdAt: Date | string;
      status: string;
      creator?: RendererCreator | null;
    };
    type: RendererTypeInput;
    form: SuperValidated<Record<string, unknown>>;
    layout: FormLayout;
    thread: RendererDetailThread;
    /** The rest of the plottable correspondence, drawn on the letter map. */
    letters?: RendererDetailMapLetter[];
    /** Relation/project picker options for the editable fields. */
    options?: RecordFormOptions;
    /** Supplied in the modal so thread prev/next flips the record in place. */
    onNavigate?: (id: string) => void;
  } = $props();

  // Provide the options to the field inputs rendered inside the detail. Options
  // come from the page load and are stable for this record's lifetime.
  // svelte-ignore state_referenced_locally
  setRecordOptions(options);

  // Edits post to /data/[id]?/save; invalidateAll refreshes the list behind the modal.
  // svelte-ignore state_referenced_locally
  const sf = superForm(form, { dataType: 'json', invalidateAll: true });

  const detailProps = $derived(
    buildRendererDetailProps(
      record,
      {
        code: type.code,
        color: type.color,
        iconSeed: type.iconSeed,
        layout,
        rendererId: type.rendererId,
      },
      { sf, thread, letters, onNavigate },
    ),
  );

  const Detail = $derived(getRenderer(type.rendererId)?.detail ?? GenericDetail);
</script>

<Detail {...detailProps} />
