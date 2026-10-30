<script lang="ts">
  import * as Form from 'formsnap';
  import type { SuperForm } from 'sveltekit-superforms';
  import type { z } from 'zod';
  import { typeSchema } from '$lib/schemas/types';
  import Icon from '$lib/forms/Icon.svelte';
  import { iconUrl } from '$lib/icons/typeIcons';
  import AlertIcon from './AlertIcon.svelte';
  import TypeColorPicker from './TypeColorPicker.svelte';
  import * as m from '$lib/paraglide/messages.js';

  // The identity card header: logo button, code + description and (in edit mode)
  // the collapse-on-scroll behaviour driven by the scoped CSS below.
  let {
    sf,
    mode,
    editingDeleted,
    accent,
    onOpenIcon,
  }: {
    sf: SuperForm<z.infer<typeof typeSchema>>;
    mode: 'create' | 'edit';
    editingDeleted: boolean;
    accent: string;
    onOpenIcon: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const { form: formData, errors } = sf;

  const codeLen = $derived(($formData.code ?? '').length);
  const descLen = $derived(($formData.description ?? '').length);

  const logoIconSrc = $derived(
    iconUrl($formData.iconSeed, $formData.code ?? 'new', accent.replace(/^#/, '')),
  );
</script>

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
        onclick={onOpenIcon}
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
            <AlertIcon />
            <span>{m.ornate_dirty_tern_bless()}</span>
          </div>
        {/if}

        <div class="my-5 border-t" style="border-color: {accent}22"></div>

        <TypeColorPicker bind:value={$formData.color} />
      </div>
    </div>
  </div>
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
