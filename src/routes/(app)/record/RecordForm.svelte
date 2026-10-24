<script lang="ts">
  import { resolve } from '$app/paths';
  import { superForm, type SuperValidated } from 'sveltekit-superforms';
  import type { FormLayout } from '$lib/forms/layout';
  import RecordField from '$lib/components/RecordField.svelte';
  import ProjectMultiselect from '$lib/components/ProjectMultiselect.svelte';
  import { setRecordOptions, type RecordFormOptions } from '$lib/forms/recordOptions';
  import * as m from '$lib/paraglide/messages.js';

  let {
    form,
    layout,
    typeId,
    options,
  }: {
    form: SuperValidated<Record<string, unknown>>;
    layout: FormLayout;
    typeId: string;
    options: RecordFormOptions;
  } = $props();

  // Provide the relation/project options to the field inputs below. The page keys
  // this component on the selected type, so they are stable for its lifetime.
  // svelte-ignore state_referenced_locally
  setRecordOptions(options);

  // svelte-ignore state_referenced_locally
  const sf = superForm(form, { dataType: 'json' });
  const { form: formData, message, enhance: saveEnhance, submitting } = sf;

  const savedId = $derived(($message as { saved?: { id: string } } | undefined)?.saved?.id);

  const selectedProjects = $derived(
    Array.isArray($formData.projectIds) ? ($formData.projectIds as string[]) : [],
  );
</script>

<form
  method="POST"
  action={`?/save&type=${typeId}`}
  class="mx-auto mt-4 flex w-full max-w-[545px] flex-col gap-4 px-3 sm:px-0"
  use:saveEnhance
>
  <ProjectMultiselect
    selected={selectedProjects}
    onChange={(ids) => (($formData.projectIds as unknown) = ids)}
  />
  {#if savedId}
    <div
      role="status"
      class="flex flex-wrap items-center gap-x-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
    >
      <span>{m.house_cuddly_gopher_transform()}</span>
      <a href={resolve('/(app)/data/[id]', { id: savedId })} class="underline"
        >{m.hour_novel_whale_push()}</a
      >
    </div>
  {/if}
  {#each layout.fields as field (field.id)}
    <RecordField {sf} {field} />
  {/each}
  <div class="flex justify-end">
    <button
      type="submit"
      disabled={$submitting}
      class="rounded bg-stone-700 px-4 py-1.5 text-sm text-white disabled:opacity-60"
      >{m.lime_gross_mole_radiate()}</button
    >
  </div>
</form>
