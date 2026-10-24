<script lang="ts">
  import { resolve } from '$app/paths';
  import { superForm, type SuperValidated } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { typeSchema } from '$lib/schemas/types';
  import type { z } from 'zod';
  import FormBuilder from '$lib/forms/FormBuilder.svelte';
  import FieldSuggestions from '$lib/forms/FieldSuggestions.svelte';
  import AlertIcon from './AlertIcon.svelte';
  import TypeLayoutWarnings from './TypeLayoutWarnings.svelte';
  import RendererPicker from './RendererPicker.svelte';
  import TypeIdentityHeader from './TypeIdentityHeader.svelte';
  import TypeIconDialog from './TypeIconDialog.svelte';
  import TypeDeleteZone from './TypeDeleteZone.svelte';
  import type { FormLayout } from '$lib/forms/layout';
  import * as m from '$lib/paraglide/messages.js';

  let {
    form,
    mode,
    editingDeleted = false,
    columnCounts = {},
  }: {
    form: SuperValidated<z.infer<typeof typeSchema>>;
    mode: 'create' | 'edit';
    editingDeleted?: boolean;
    /** Edit mode: records of this type holding data, per column. */
    columnCounts?: Record<string, number>;
  } = $props();

  let iconDialog = $state<{ show: () => void } | null>(null);
  // Hidden until the suggestions report something, so SSR doesn't flash the header.
  let suggestVisible = $state(false);

  // svelte-ignore state_referenced_locally
  const sf = superForm(form, {
    dataType: 'json',
    validators: zod4Client(typeSchema),
    onSubmit: ({ cancel }) => {
      // The layout keeps the last valid default while a draft is invalid; saving
      // now would silently drop what the user typed.
      if (hasBadDefault) cancel();
    },
  });
  let hasBadDefault = $state(false);
  const { form: formData, errors, enhance: saveEnhance, submitting } = sf;

  // The code as saved: the delete confirmation names what will be deleted, not an
  // unsaved edit in the field.
  const savedCode = $derived(form.data.code);
  // The layout as loaded, to compare the unsaved edit against.
  const savedLayout = $derived((form.data.layout as FormLayout | null) ?? null);

  // Every message zod raised for the layout or color. Per-field issues have no
  // input of their own to sit beside (the builder shows rows, not errors), so
  // they are listed together above the save bar.
  function collectMessages(e: unknown): string[] {
    if (typeof e === 'string') return [e];
    if (e && typeof e === 'object') return Object.values(e).flatMap(collectMessages);
    return [];
  }
  const formIssues = $derived([
    ...new Set([...collectMessages($errors.layout), ...collectMessages($errors.color)]),
  ]);

  const accent = $derived($formData.color ?? '#78716c');
</script>

<nav
  class="mx-auto breadcrumbs w-full max-w-[820px] px-3 pt-4 text-sm sm:px-4 sm:pt-6"
  aria-label={m.strong_just_maggot_wave()}
>
  <ul>
    <li>
      <a href={resolve('/(app)/types')}>{m.quiet_pink_parrot_clasp()}</a>
    </li>
    <li class="font-medium" aria-current="page">
      {mode === 'create' ? m.smart_basic_fireant_rush() : $formData.code}
    </li>
  </ul>
</nav>

<div class="mx-auto w-full max-w-[820px] px-3 py-4 sm:px-4 sm:py-6">
  <form id="TypeForm" method="POST" action="?/save" class="flex flex-col gap-5" use:saveEnhance>
    <!-- IDENTITY + FIELDS unified card -->
    <section
      class="identity-widget group/identity rounded-box border transition-colors duration-300"
      style="background-color: {accent}10; border-color: {accent}33"
    >
      <TypeIdentityHeader
        {sf}
        {mode}
        {editingDeleted}
        {accent}
        onOpenIcon={() => iconDialog?.show()}
      />
      {#if $formData.layout && ($formData.layout as FormLayout).fields.length > 0}
        <div class="border-t px-5 py-5 sm:px-7 sm:py-6" style="border-color: {accent}22">
          <h2 class="text-sm font-semibold">{m.blue_pretty_sparrow_taste()}</h2>
          <div
            class="mt-3 rounded-box border bg-base-100 p-4 shadow-sm sm:p-5"
            style="border-color: {accent}22"
          >
            <FormBuilder bind:layout={$formData.layout as FormLayout} bind:hasBadDefault />
          </div>

          {#if mode === 'edit'}
            <TypeLayoutWarnings
              saved={savedLayout}
              layout={$formData.layout as FormLayout | null}
              counts={columnCounts}
            />
          {/if}

          <!-- Add-field suggestions: in the Form block, below the builder, separated -->
          <div class={['mt-5 flex flex-col gap-2', !suggestVisible && 'hidden']}>
            <div class="flex items-center gap-2 px-1">
              <span class="text-[11px] font-semibold tracking-wide text-base-content/40 uppercase">
                {m.weary_large_otter_revive()}
              </span>
              <span class="h-px flex-1 border-t border-dashed border-base-300"></span>
            </div>
            <FieldSuggestions
              bind:layout={$formData.layout as FormLayout}
              typeCode={$formData.code}
              typeDescription={$formData.description}
              onVisibilityChange={(v) => (suggestVisible = v)}
            />
          </div>
        </div>
      {/if}
    </section>

    <section class="rounded-box border px-5 py-5 sm:px-7 sm:py-6" style="border-color: {accent}22">
      <h2 class="text-sm font-semibold">{m.good_bright_bulldog_bloom()}</h2>
      <p class="mt-1 text-xs text-base-content/60">
        {m.chunky_salty_bird_support()}
      </p>
      <div class="mt-3">
        <RendererPicker
          value={$formData.rendererId ?? null}
          onChange={(v) => ($formData.rendererId = v)}
          layout={($formData.layout as FormLayout | null) ?? null}
          code={$formData.code}
          color={$formData.color}
          iconSeed={$formData.iconSeed ?? null}
          {accent}
        />
      </div>
    </section>
  </form>

  <TypeIconDialog
    bind:this={iconDialog}
    bind:iconSeed={$formData.iconSeed}
    code={$formData.code}
    description={$formData.description}
    {accent}
  />

  {#if formIssues.length > 0}
    <div role="alert" class="mt-6 alert alert-soft alert-error">
      <AlertIcon />
      <div>
        <p class="font-medium">{m.every_crisp_impala_stab()}</p>
        <ul class="list-inside list-disc text-sm">
          {#each formIssues as issue (issue)}
            <li>{issue}</li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}

  <!-- STICKY ACTION BAR -->
  <div
    class="sticky bottom-0 z-10 -mx-3 mt-6 flex items-center justify-end gap-2 border-t border-base-300 bg-base-100/85 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4"
  >
    {#if hasBadDefault}
      <p role="alert" class="mr-auto text-sm text-error">{m.fluffy_elegant_rook_attend()}</p>
    {/if}
    <a href={resolve('/(app)/types')} class="btn btn-ghost">{m.minor_basic_vulture_renew()}</a>
    <button
      type="submit"
      form="TypeForm"
      disabled={$submitting || hasBadDefault}
      class="btn btn-primary"
    >
      {#if $submitting}
        <span class="loading loading-xs loading-spinner"></span>
        <span>{m.neat_plane_bumblebee_accept()}</span>
      {:else}
        <span>{m.lime_gross_mole_radiate()}</span>
      {/if}
    </button>
  </div>

  {#if mode === 'edit'}
    <TypeDeleteZone typeId={$formData.id} {savedCode} {editingDeleted} />
  {/if}
</div>
