<script lang="ts">
  import DetailShell from './DetailShell.svelte';
  import RecordField from '$lib/components/RecordField.svelte';
  import { buildRendererProps, type RendererDetailProps } from '$lib/render/props';
  import { previewRelations } from '$lib/render/previewRow';
  import { getRecordOptions } from '$lib/forms/recordOptions';
  import { getRenderer } from '$lib/renderers/registry';

  // The fallback editable detail, used when a renderer supplies no bespoke
  // `detail`. It still puts the type in control of the presentation by showing
  // the type's own card as a LIVE preview (rebuilt from the form values as you
  // edit), with the editable fields underneath.
  let { sf, layout, record }: RendererDetailProps = $props();

  // form values are keyed by writeTo — the same shape buildRendererProps reads.
  // svelte-ignore state_referenced_locally
  const { form: formData } = sf;

  // Resolve relation ids + project membership from the loaded options so the
  // preview card shows labels/chips for the in-progress edit, before saving.
  const options = getRecordOptions();

  const renderer = $derived(getRenderer(record.type.rendererId));
  const PreviewCard = $derived(renderer?.card ?? null);
  const previewProps = $derived.by(() => {
    const rel = previewRelations($formData, options);
    return buildRendererProps(
      {
        ...$formData,
        createdAt: record.createdAt,
        status: record.status,
        creator: rel.creator ?? record.creator,
        assignee: rel.assignee,
        record: rel.record,
        projects: rel.projects,
      },
      {
        code: record.type.code,
        color: record.type.color,
        iconSeed: record.type.iconSeed,
        layout,
      },
    );
  });
</script>

<DetailShell {sf} {record}>
  {#if PreviewCard}
    <div class="mx-auto h-40 w-full max-w-sm">
      <PreviewCard {...previewProps} />
    </div>
  {/if}
  <div class="flex flex-col gap-4">
    {#each layout.fields as field (field.id)}
      <RecordField {sf} {field} />
    {/each}
  </div>
</DetailShell>
