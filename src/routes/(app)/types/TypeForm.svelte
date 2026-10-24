<script lang="ts">
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';
  import * as Form from 'formsnap';
  import { superForm, type SuperValidated } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { DEFAULT_TYPE_COLOR, typeSchema } from '$lib/schemas/types';
  import type { z } from 'zod';
  import FormBuilder from '$lib/forms/FormBuilder.svelte';
  import FieldSuggestions from '$lib/forms/FieldSuggestions.svelte';
  import Icon from '$lib/forms/Icon.svelte';
  import RendererPicker from './RendererPicker.svelte';
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import { humanizeIconName, iconUrl, sampleIcons, TYPE_ICONS } from '$lib/icons/typeIcons';
  import { suggestIcons } from '$lib/icons/suggestIcons';
  import type { FormLayout } from '$lib/forms/layout';
  import { rovingIndex } from '$lib/utils/roving';
  import * as m from '$lib/paraglide/messages.js';

  const COLORS = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#d946ef',
    '#ec4899',
  ];

  const ICON_COUNT = 24;

  let {
    form,
    mode,
    editingDeleted = false,
  }: {
    form: SuperValidated<z.infer<typeof typeSchema>>;
    mode: 'create' | 'edit';
    editingDeleted?: boolean;
  } = $props();

  let permaDeleteError = $state<string | null>(null);
  let permaDeleteCount = $state(0);
  let seeds = $state<string[]>(sampleIcons(ICON_COUNT));
  let iconDialog = $state<HTMLDialogElement | null>(null);
  let iconDialogOpen = $state(false);
  let confirmDialog = $state<HTMLDialogElement | null>(null);
  let confirming = $state<'delete' | 'permanentlyDelete'>('delete');
  // Hidden until the suggestions report something, so SSR doesn't flash the header.
  let suggestVisible = $state(false);

  // svelte-ignore state_referenced_locally
  const sf = superForm(form, {
    dataType: 'json',
    validators: zod4Client(typeSchema),
  });
  const { form: formData, errors, enhance: saveEnhance, submitting } = sf;

  // Deriving just these two keeps the effect from re-running (and reshuffling the
  // icon grid) on every unrelated form edit: $derived only notifies on change.
  // The code as saved: the delete confirmation names what will be deleted, not an
  // unsaved edit in the field.
  const savedCode = $derived(form.data.code);
  const typeCodeValue = $derived($formData.code);
  const typeDescriptionValue = $derived($formData.description);

  // Immediate first suggestion, then debounced; the cleanup drops stale results
  // and aborts a model run that is still going.
  let firstSuggest = true;
  $effect(() => {
    const typeCode = typeCodeValue;
    const typeDescription = typeDescriptionValue;
    const controller = new AbortController();
    let stale = false;
    const timer = setTimeout(
      async () => {
        const picks = await suggestIcons(
          { typeCode, typeDescription },
          ICON_COUNT,
          controller.signal,
        );
        if (!stale) seeds = picks;
      },
      firstSuggest ? 0 : 500,
    );
    firstSuggest = false;
    return () => {
      stale = true;
      controller.abort();
      clearTimeout(timer);
    };
  });

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

  function openIconDialog() {
    iconDialogOpen = true;
    iconDialog?.showModal();
  }

  function askConfirm(kind: 'delete' | 'permanentlyDelete') {
    confirming = kind;
    confirmDialog?.showModal();
  }

  const accent = $derived($formData.color ?? '#78716c');
  const currentColor = $derived(($formData.color ?? '').toLowerCase());
  const swatchIndex = $derived(COLORS.indexOf(currentColor));
  const customColorSelected = $derived(currentColor !== '' && swatchIndex < 0);

  let swatchRefs: (HTMLElement | null)[] = $state([]);
  let customColorInput: HTMLInputElement | null = $state(null);
  const currentSwatchIndex = $derived(
    swatchIndex >= 0 ? swatchIndex : customColorSelected ? COLORS.length : 0,
  );

  function openCustomColorPicker() {
    if (!customColorInput) return;
    try {
      customColorInput.showPicker();
    } catch {
      customColorInput.click();
    }
  }

  function onSwatchKeydown(e: KeyboardEvent) {
    const len = COLORS.length + 1;
    if ((e.key === 'Enter' || e.key === ' ') && currentSwatchIndex === COLORS.length) {
      e.preventDefault();
      openCustomColorPicker();
      return;
    }
    const next = rovingIndex(e.key, currentSwatchIndex, len);
    if (next === null) return;
    e.preventDefault();
    if (next < COLORS.length) $formData.color = COLORS[next];
    swatchRefs[next]?.focus();
  }
  const codeLen = $derived(($formData.code ?? '').length);
  const descLen = $derived(($formData.description ?? '').length);

  const logoIconSrc = $derived(
    iconUrl($formData.iconSeed, $formData.code ?? 'new', accent.replace(/^#/, '')),
  );

  const filteredIcons = $derived.by(() => {
    const seed = $formData.iconSeed;
    const ranked =
      !seed || seeds.includes(seed) ? seeds : [seed, ...seeds.slice(0, seeds.length - 1)];
    const rankedSet = new Set(ranked);
    const rest = TYPE_ICONS.filter((n) => !rankedSet.has(n));
    return [...ranked, ...rest];
  });
</script>

{#snippet alertIcon()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="size-5 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
    />
  </svg>
{/snippet}

{#snippet counter(group: string, len: number, max: number, warnAt: number)}
  <span
    class={[
      'pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[11px] font-normal tabular-nums opacity-0 transition-opacity',
      group === 'code'
        ? 'group-focus-within/code:opacity-100'
        : 'group-focus-within/desc:opacity-100',
      len >= max
        ? 'text-error opacity-100'
        : len >= warnAt
          ? 'text-warning opacity-100'
          : 'text-base-content/40',
    ]}
  >
    {len}/{max}
  </span>
{/snippet}

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
      <div
        class={[
          'identity-stickable relative',
          mode === 'edit' && 'identity-collapsible sticky top-[70px] z-20 backdrop-blur',
        ]}
        style="--accent: {accent}; background-color: color-mix(in srgb, {accent} 10%, transparent)"
      >
        <div class="identity-pad p-5 sm:p-7">
          <!-- Preview + code/description -->
          <div class="identity-row flex items-start gap-4 sm:gap-6">
            <button
              type="button"
              onclick={openIconDialog}
              class="identity-logo group/badge relative shrink-0 overflow-hidden ring-2 transition focus:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
              style="background-color: {accent}; --tw-ring-color: {accent}"
              aria-label={m.polite_any_warthog_intend()}
              title={m.polite_any_warthog_intend()}
            >
              <img
                src={logoIconSrc}
                alt={$formData.code || ($formData.iconSeed ?? 'new')}
                class="size-full transition group-hover/badge:scale-105"
              />
              <span
                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover/badge:opacity-100"
              >
                <Icon name="pencil" size={22} />
              </span>
            </button>
            <div class="identity-content min-w-0 flex-1">
              <Form.Field form={sf} name="code">
                <Form.Control>
                  {#snippet children({ props })}
                    <div class="group/code relative">
                      <input
                        {...props}
                        type="text"
                        maxlength="40"
                        placeholder={mode === 'create'
                          ? m.great_tidy_frog_gasp()
                          : m.curly_simple_gazelle_fetch()}
                        bind:value={$formData.code}
                        class={[
                          'identity-code w-full rounded-md border-0 bg-transparent px-1 py-0.5 font-semibold transition-colors outline-none focus:bg-base-100/70 focus:ring-2',
                          $errors.code?.length && 'text-error',
                        ]}
                        style="--tw-ring-color: {accent}55"
                      />
                      {@render counter('code', codeLen, 40, 32)}
                    </div>
                    {#if $errors.code?.length}
                      <span class="mt-1 block px-1 text-xs text-error">{$errors.code[0]}</span>
                    {/if}
                  {/snippet}
                </Form.Control>
              </Form.Field>

              <Form.Field form={sf} name="description">
                <Form.Control>
                  {#snippet children({ props })}
                    <div class="group/desc relative mt-0.5">
                      <input
                        {...props}
                        type="text"
                        maxlength="200"
                        placeholder={m.happy_strong_toucan_aim()}
                        bind:value={$formData.description}
                        class="identity-desc w-full truncate rounded-md border-0 bg-transparent px-1 py-0.5 text-base-content/70 transition-colors outline-none placeholder:text-base-content/50 focus:bg-base-100/70 focus:text-base-content focus:ring-2"
                        style="--tw-ring-color: {accent}55"
                      />
                      {@render counter('desc', descLen, 200, 170)}
                    </div>
                  {/snippet}
                </Form.Control>
              </Form.Field>
            </div>
          </div>

          <div class="identity-extras-wrap">
            <div class="identity-extras">
              {#if editingDeleted}
                <div role="alert" class="mt-4 alert alert-soft alert-warning">
                  {@render alertIcon()}
                  <span>{m.ornate_dirty_tern_bless()}</span>
                </div>
              {/if}

              <div class="my-5 border-t" style="border-color: {accent}22"></div>

              <!-- Color -->
              <div class="fieldset">
                <div
                  id="color-legend"
                  class="fieldset-legend flex w-full items-baseline justify-between pb-1"
                >
                  <span>{m.early_helpful_capybara_embrace()}</span>
                  <span class="font-mono text-[11px] font-normal text-base-content/40 uppercase">
                    {currentColor}
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-labelledby="color-legend"
                  tabindex={-1}
                  class="flex flex-wrap gap-2 p-1"
                  onkeydown={onSwatchKeydown}
                >
                  {#each COLORS as color, i (color)}
                    {@const selected = color === currentColor}
                    <button
                      bind:this={swatchRefs[i]}
                      type="button"
                      onclick={(e) => {
                        $formData.color = color;
                        e.currentTarget.focus();
                      }}
                      role="radio"
                      aria-label={color}
                      aria-checked={selected}
                      tabindex={i === currentSwatchIndex ? 0 : -1}
                      title={color}
                      class={[
                        'flex size-9 items-center justify-center rounded-xl shadow-sm transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 active:scale-95',
                        selected ? 'ring-2 ring-offset-2 ring-offset-base-100' : 'hover:scale-105',
                      ]}
                      style="background-color: {color}; --tw-ring-color: {color}"
                    >
                      {#if selected}
                        <Icon name="check" size={18} stroke="white" strokeWidth={3} />
                      {/if}
                    </button>
                  {/each}
                  <div class="relative">
                    <input
                      bind:this={customColorInput}
                      type="color"
                      value={$formData.color ?? DEFAULT_TYPE_COLOR}
                      tabindex={-1}
                      aria-hidden="true"
                      class="pointer-events-none absolute inset-0 size-full opacity-0"
                      oninput={(e) => ($formData.color = e.currentTarget.value)}
                    />
                    <button
                      bind:this={swatchRefs[COLORS.length]}
                      type="button"
                      role="radio"
                      aria-label={m.mean_left_parrot_reap()}
                      aria-checked={customColorSelected}
                      tabindex={currentSwatchIndex === COLORS.length ? 0 : -1}
                      onclick={(e) => {
                        e.currentTarget.focus();
                        openCustomColorPicker();
                      }}
                      title={customColorSelected
                        ? ($formData.color ?? m.mean_left_parrot_reap())
                        : m.mean_left_parrot_reap()}
                      class={[
                        'relative flex size-9 cursor-pointer items-center justify-center rounded-xl transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 active:scale-95',
                        customColorSelected
                          ? 'shadow-sm ring-2 ring-offset-2 ring-offset-base-100 hover:scale-105'
                          : 'border-2 border-dashed border-base-300 text-base-content/50 hover:scale-105 hover:border-primary hover:text-primary',
                      ]}
                      style={customColorSelected
                        ? `background-color: ${$formData.color}; --tw-ring-color: ${$formData.color}`
                        : '--tw-ring-color: var(--color-primary)'}
                    >
                      {#if customColorSelected}
                        <Icon name="check" size={18} stroke="white" strokeWidth={3} />
                      {:else}
                        <Icon name="palette" size={16} />
                      {/if}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {#if $formData.layout && ($formData.layout as FormLayout).fields.length > 0}
        <div class="border-t px-5 py-5 sm:px-7 sm:py-6" style="border-color: {accent}22">
          <h2 class="text-sm font-semibold">{m.blue_pretty_sparrow_taste()}</h2>
          <div
            class="mt-3 rounded-box border bg-base-100 p-4 shadow-sm sm:p-5"
            style="border-color: {accent}22"
          >
            <FormBuilder bind:layout={$formData.layout as FormLayout} />
          </div>

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

  <!-- Icon picker dialog -->
  <dialog
    bind:this={iconDialog}
    class="modal"
    aria-labelledby="icon-dialog-title"
    onclose={() => (iconDialogOpen = false)}
  >
    <div class="modal-box flex max-h-[85vh] max-w-2xl flex-col p-0">
      <div class="min-w-0 border-b border-base-300 p-5">
        <h3 id="icon-dialog-title" class="text-base font-semibold">
          {m.patchy_few_reindeer_tend()}
        </h3>
        {#if $formData.iconSeed}
          <p class="mt-0.5 truncate text-xs text-base-content/60">
            {m.gaudy_short_bumblebee_breathe()}
            <span class="font-medium text-base-content">
              {humanizeIconName($formData.iconSeed)}
            </span>
          </p>
        {/if}
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <!-- Only while open: ~150 icon images would otherwise load from a third party on every page view. -->
        {#if iconDialogOpen}
          <div class="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {#each filteredIcons as seed (seed)}
              {@const selected = seed === $formData.iconSeed}
              <button
                type="button"
                onclick={() => {
                  $formData.iconSeed = seed;
                  iconDialog?.close();
                }}
                aria-label={humanizeIconName(seed)}
                aria-pressed={selected}
                title={humanizeIconName(seed)}
                class={[
                  'group flex aspect-square items-center justify-center rounded-box transition active:scale-95',
                  selected ? '' : 'hover:bg-base-200',
                ]}
                style={selected
                  ? `box-shadow: 0 0 0 2px var(--color-base-100) inset, 0 0 0 3px ${accent}`
                  : ''}
              >
                <TypeBadge
                  code={$formData.code || seed}
                  color={accent}
                  iconSeed={seed}
                  class="size-10 rounded-xl transition group-hover:scale-105"
                />
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-between gap-2 border-t border-base-300 p-4">
        <span class="text-xs text-base-content/50">
          {m.icy_solid_jellyfish_peek({ count: filteredIcons.length })}
        </span>
        <button type="button" class="btn btn-ghost" onclick={() => iconDialog?.close()}>
          {m.acidic_jolly_ladybug_slide()}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button aria-label={m.major_sleek_macaw_shine()}>{m.yummy_alive_termite_commend()}</button>
    </form>
  </dialog>

  {#if formIssues.length > 0}
    <div role="alert" class="mt-6 alert alert-soft alert-error">
      {@render alertIcon()}
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
    <a href={resolve('/(app)/types')} class="btn btn-ghost">{m.minor_basic_vulture_renew()}</a>
    <button type="submit" form="TypeForm" disabled={$submitting} class="btn btn-primary">
      {#if $submitting}
        <span class="loading loading-xs loading-spinner"></span>
        <span>{m.neat_plane_bumblebee_accept()}</span>
      {:else}
        <span>{m.lime_gross_mole_radiate()}</span>
      {/if}
    </button>
  </div>

  <!-- DANGER ZONE -->
  {#if mode === 'edit'}
    <section class="card mt-8 border border-error/30 bg-error/5">
      <div class="card-body p-5 sm:p-6">
        <h2 class="card-title text-sm text-error">{m.merry_every_beaver_gulp()}</h2>
        <p class="text-xs text-error/80">
          {#if editingDeleted}
            {m.cozy_flat_crab_rush()}
          {:else}
            {m.mushy_muddy_monkey_grin()}
          {/if}
        </p>

        <div class="mt-2 card-actions">
          {#if !editingDeleted}
            <form id="TypeDeleteForm" method="POST" action="?/delete" use:enhance></form>
            <button
              type="button"
              class="btn btn-outline btn-sm btn-error"
              onclick={() => askConfirm('delete')}>{m.plane_small_ocelot_jest()}</button
            >
          {:else}
            <form method="POST" action="?/restore" use:enhance>
              <button type="submit" class="btn btn-outline btn-sm"
                >{m.busy_low_jellyfish_foster()}</button
              >
            </form>
            <form
              id="TypePermanentDeleteForm"
              method="POST"
              action="?/permanentlyDelete"
              use:enhance={() =>
                async ({ result, update }) => {
                  if (result.type === 'failure') {
                    const d = result.data as { error?: string; recordCount?: number } | undefined;
                    permaDeleteError = d?.error ?? m.mild_jumpy_pig_persist();
                    permaDeleteCount = d?.recordCount ?? 0;
                    return;
                  }
                  await update();
                }}
            ></form>
            <button
              type="button"
              class="btn btn-sm btn-error"
              onclick={() => askConfirm('permanentlyDelete')}>{m.cool_candid_piranha_chop()}</button
            >
          {/if}
        </div>

        <dialog
          bind:this={confirmDialog}
          class="modal"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-body"
        >
          <div class="modal-box max-w-md">
            <h3 id="confirm-dialog-title" class="text-base font-semibold">
              {m.dirty_trick_lynx_edit()}
            </h3>
            <p id="confirm-dialog-body" class="mt-2 text-sm">
              {confirming === 'delete'
                ? m.funny_nice_snake_ascend({ code: savedCode })
                : m.inner_late_earthworm_savor({ code: savedCode })}
            </p>
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" onclick={() => confirmDialog?.close()}>
                {m.minor_basic_vulture_renew()}
              </button>
              <button
                type="submit"
                form={confirming === 'delete' ? 'TypeDeleteForm' : 'TypePermanentDeleteForm'}
                class="btn btn-error"
                onclick={() => confirmDialog?.close()}
              >
                {confirming === 'delete'
                  ? m.plane_small_ocelot_jest()
                  : m.cool_candid_piranha_chop()}
              </button>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button aria-label={m.major_sleek_macaw_shine()}
              >{m.yummy_alive_termite_commend()}</button
            >
          </form>
        </dialog>

        {#if permaDeleteError}
          <div role="alert" class="mt-3 alert alert-error">
            {@render alertIcon()}
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{permaDeleteError}</span>
              {#if permaDeleteCount > 0 && $formData.id}
                <!-- href is resolve()-built but carries a query string, which the rule can't verify -->
                <!-- eslint-disable svelte/no-navigation-without-resolve -->
                <a
                  href={resolve('/(app)/data') +
                    `?type=${encodeURIComponent($formData.id)}&deleted=1`}
                  class="link whitespace-nowrap"
                >
                  {m.candid_smug_cowfish_tickle({ count: permaDeleteCount })}
                </a>
                <!-- eslint-enable svelte/no-navigation-without-resolve -->
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  /* All collapse-driven properties interpolate against --c (0 = expanded, 1 = collapsed).
     --c is driven by a CSS scroll-driven animation anchored to the root scroller:
     0 at scrollY=0 (fully expanded), 1 at scrollY=80px (fully collapsed).
     Runs on the compositor for buttersmooth scroll sync. */
  .identity-stickable {
    /* `position` is intentionally not set here: the markup provides it via
       Tailwind's `relative` (always) plus `sticky` (edit mode wins via
       Tailwind's class-ordering). Overriding it from the scoped style block
       would beat the utility on specificity and break stickiness. */
    isolation: isolate;
    overflow: hidden;
    border-top-left-radius: calc((1 - var(--c)) * var(--radius-box, 1rem));
    border-top-right-radius: calc((1 - var(--c)) * var(--radius-box, 1rem));
  }
  /* Tint fade-in lives on a single opacity-animated layer instead of being
     baked into the element's background via color-mix(... calc(... * --c) ...),
     which would force the whole element to repaint on every scroll tick. */
  .identity-stickable::before {
    content: '';
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    opacity: var(--c);
    pointer-events: none;
    z-index: -1;
  }
  .identity-collapsible {
    animation: identity-collapse linear both;
    animation-timeline: scroll(root block);
    animation-range: 35px 90px;
  }
  @keyframes identity-collapse {
    to {
      --c: 1;
    }
  }
  .identity-pad {
    padding: calc(1.25rem + (0.25rem - 1.25rem) * var(--c));
  }
  @media (min-width: 640px) {
    .identity-pad {
      padding-block: calc(1.75rem + (0.25rem - 1.75rem) * var(--c));
      padding-inline: calc(1.75rem + (0.5rem - 1.75rem) * var(--c));
    }
  }
  .identity-row {
    align-items: center;
    gap: calc(1rem + (0.5rem - 1rem) * var(--c));
    /* Enforce the interpolated height — without overflow + min-height: 0,
       the stacked code/desc inputs in .identity-content would force the row
       (and therefore the sticky bar) to grow to their natural stacked size,
       defeating the collapse. */
    height: calc(4rem + (3.5rem - 4rem) * var(--c));
    min-height: 0;
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .identity-row {
      gap: calc(1.5rem + (0.625rem - 1.5rem) * var(--c));
      height: calc(5rem + (3.5rem - 5rem) * var(--c));
    }
  }
  .identity-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(4rem + (2.5rem - 4rem) * var(--c));
    height: calc(4rem + (2.5rem - 4rem) * var(--c));
    border-radius: calc(0.75rem + (0.375rem - 0.75rem) * var(--c));
    box-shadow: 0 1px 2px rgb(0 0 0 / calc(0.05 + 0.1 * var(--c)));
  }
  @media (min-width: 640px) {
    .identity-logo {
      width: calc(5rem + (2.5rem - 5rem) * var(--c));
      height: calc(5rem + (2.5rem - 5rem) * var(--c));
    }
  }
  .identity-content {
    min-width: 0;
    min-height: 0;
    padding-left: calc(var(--c) * 0.25rem);
  }
  .identity-code {
    font-size: calc(1.5rem + (0.95rem - 1.5rem) * var(--c));
    line-height: 1.2;
  }
  @media (min-width: 640px) {
    .identity-code {
      font-size: calc(1.875rem + (0.95rem - 1.875rem) * var(--c));
    }
  }
  .identity-desc {
    font-size: calc(0.875rem + (0.75rem - 0.875rem) * var(--c));
    line-height: 1.25;
  }
  @media (min-width: 640px) {
    .identity-desc {
      font-size: calc(1rem + (0.75rem - 1rem) * var(--c));
    }
  }
  /* Grid 1fr → 0fr collapse: lets the extras row shrink from its natural
     content height to zero without an arbitrary max-height cap and without
     having to know the height in pixels. Driven by its own scroll-timeline
     keyframe (rather than `calc(... * 1fr)` against --c) because browsers
     only interpolate <flex> values when they're keyframe endpoints. */
  .identity-extras-wrap {
    display: grid;
    grid-template-rows: 1fr;
  }
  .identity-collapsible .identity-extras-wrap {
    animation: identity-extras-collapse linear both;
    animation-timeline: scroll(root block);
    animation-range: 35px 90px;
  }
  @keyframes identity-extras-collapse {
    to {
      grid-template-rows: 0fr;
    }
  }
  .identity-extras {
    min-height: 0;
    overflow: hidden;
    opacity: calc(1 - var(--c));
  }
</style>
