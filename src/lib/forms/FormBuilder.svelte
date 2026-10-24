<script lang="ts">
  import {
    availableColumnsForField,
    canRemoveField,
    duplicateLabels,
    isKindAvailableForField,
    removeField,
    setFieldDefault,
    setFieldKind,
    setFieldRequired,
    updateField,
  } from './builder';
  import { inputTypeFor } from '$lib/fields/inputHelpers';
  import { defaultToText, parseDefault, supportsDefault } from './defaultValue';
  import { kindMeta } from './kindMeta';
  import Icon from './Icon.svelte';
  import type { FormLayout } from './layout';
  import { humanizeIdentifier } from '$lib/utils/humanize';
  import { rovingIndex } from '$lib/utils/roving';
  import { FIELD_KINDS } from '$lib/schemas/types';
  import * as m from '$lib/paraglide/messages.js';

  // The daisyUI dropdown stays open while focus is inside it, so closing means
  // moving focus out. Land on the row's label input rather than <body>.
  function closeDropdown(menu: Element | null) {
    const row = menu?.closest('li:not([role])') ?? null;
    row?.querySelector<HTMLElement>('input[type="text"]')?.focus();
  }

  function onMenuKeydown(e: KeyboardEvent) {
    const root = e.currentTarget as HTMLElement;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown(root);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...root.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      current < 0
        ? e.key === 'ArrowDown' || e.key === 'Home'
          ? 0
          : items.length - 1
        : rovingIndex(e.key, current, items.length);
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
  }

  let {
    layout = $bindable(),
    // Write-only for the parent: it is bound out, never read here.
    // eslint-disable-next-line no-useless-assignment
    hasBadDefault = $bindable(false),
  }: {
    layout: FormLayout;
    /** True while any default-value control holds text that doesn't fit its kind. */
    hasBadDefault?: boolean;
  } = $props();

  const dupLabels = $derived(duplicateLabels(layout));

  // What the user is typing into each default-value control, and whether it
  // currently fits the field's kind. The layout only ever holds valid defaults, so while a draft is invalid the
  // parent is told (`hasBadDefault`) and must block saving.
  let drafts = $state<Record<string, string>>({});
  let badDefault = $state<Record<string, boolean>>({});

  function syncBadDefault() {
    hasBadDefault = Object.values(badDefault).some(Boolean);
  }

  function onDefaultInput(field: FormLayout['fields'][number], raw: string) {
    drafts[field.id] = raw;
    const parsed = parseDefault(field.kind, raw);
    badDefault[field.id] = !parsed.ok;
    syncBadDefault();
    if (parsed.ok) layout = setFieldDefault(layout, field.id, parsed.value);
  }

  function resetDraft(id: string) {
    delete drafts[id];
    delete badDefault[id];
    syncBadDefault();
  }
</script>

{#snippet fieldRowContent(field: FormLayout['fields'][number])}
  {@const isDupLabel = dupLabels.has(field.label)}
  {@const cols = availableColumnsForField(layout, field.id, field.kind)}
  {@const meta = kindMeta(field.kind)}
  <div class="flex flex-wrap items-center gap-2">
    <input
      type="text"
      value={field.label}
      placeholder={m.just_long_panda_trust()}
      aria-label={m.just_long_panda_trust()}
      data-testid={`field-label-${field.id}`}
      oninput={(e) => (layout = updateField(layout, field.id, { label: e.currentTarget.value }))}
      aria-invalid={isDupLabel ? 'true' : undefined}
      aria-describedby={isDupLabel ? `dup-${field.id}` : undefined}
      class={[
        'min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm font-medium transition-colors focus:outline-2 focus:outline-offset-1 focus:outline-primary',
        isDupLabel
          ? 'border-error bg-error/5 text-error'
          : 'border-transparent hover:border-base-300 focus:border-base-300',
      ]}
    />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dropdown dropdown-end" onkeydown={onMenuKeydown}>
      <!-- tabindex looks redundant on a button, but Safari doesn't focus buttons
           on click without it, and daisyUI's dropdown opens on focus. -->
      <button
        type="button"
        tabindex="0"
        data-testid={`field-kind-${field.id}`}
        aria-haspopup="menu"
        aria-label={m.plane_weird_kudu_express({ label: meta.label })}
        title={m.upper_same_chipmunk_lift()}
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-base-200 px-2 py-1 text-xs font-medium text-base-content/80 transition hover:bg-base-300 focus:outline-2 focus:outline-offset-1 focus:outline-primary"
      >
        <Icon name={field.kind} class="size-3.5 text-base-content/60" />
        <span>{meta.label}</span>
        <Icon name="chevron" class="size-3 text-base-content/40" />
      </button>
      <ul
        tabindex="0"
        role="menu"
        class="dropdown-content menu z-40 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
      >
        {#each FIELD_KINDS as kind (kind)}
          {@const km = kindMeta(kind)}
          {@const selected = kind === field.kind}
          {@const disabled = !selected && !isKindAvailableForField(layout, field.id, kind)}
          <li role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              aria-disabled={disabled}
              title={disabled ? m.quiet_good_leopard_rush() : km.hint}
              onclick={(e) => {
                if (disabled) return;
                layout = setFieldKind(layout, field.id, kind);
                resetDraft(field.id);
                closeDropdown(e.currentTarget);
              }}
              class={[
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left',
                disabled && 'cursor-not-allowed opacity-40',
                selected && 'bg-base-200',
              ]}
            >
              <Icon name={kind} class="size-4 shrink-0 text-base-content/70" />
              <span class="flex min-w-0 flex-1 flex-col leading-tight">
                <span class="text-sm font-medium">{km.label}</span>
                <span class="truncate text-[11px] text-base-content/50">{km.hint}</span>
              </span>
              {#if selected}
                <Icon name="check" class="size-3.5 text-primary" strokeWidth={2.5} />
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    </div>

    {#if cols.length <= 1}
      <span
        data-testid={`field-writeto-${field.id}`}
        title={m.blue_bad_worm_bloom({ column: field.writeTo })}
        class="inline-flex max-w-[180px] items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-base-content/40"
      >
        <Icon name="arrow" class="size-3 shrink-0" />
        <span class="truncate">{humanizeIdentifier(field.writeTo)}</span>
      </span>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="dropdown dropdown-end" onkeydown={onMenuKeydown}>
        <!-- tabindex for Safari, as on the kind trigger above. -->
        <button
          type="button"
          tabindex="0"
          data-testid={`field-writeto-${field.id}`}
          aria-haspopup="menu"
          aria-label={m.flat_fresh_termite_commend({ column: field.writeTo })}
          title={m.lofty_heroic_ant_create()}
          class="inline-flex max-w-[200px] cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-base-content/50 transition hover:bg-base-200 hover:text-base-content/80 focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        >
          <Icon name="arrow" class="size-3 shrink-0" />
          <span class="truncate">{humanizeIdentifier(field.writeTo)}</span>
        </button>
        <ul
          tabindex="0"
          role="menu"
          class="dropdown-content menu z-40 mt-1 w-60 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
        >
          <li
            role="none"
            class="menu-title px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wide text-base-content/40 uppercase"
          >
            {m.lofty_heroic_ant_create()}
          </li>
          {#each cols as col (col)}
            {@const selected = col === field.writeTo}
            <li role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onclick={(e) => {
                  layout = updateField(layout, field.id, { writeTo: col });
                  closeDropdown(e.currentTarget);
                }}
                class={[
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  selected && 'bg-base-200',
                ]}
              >
                <span class="flex min-w-0 flex-1 flex-col leading-tight">
                  <span class="text-sm font-medium">{humanizeIdentifier(col)}</span>
                  <span class="truncate font-mono text-[10px] text-base-content/50">
                    {col}
                  </span>
                </span>
                {#if selected}
                  <Icon name="check" class="size-3.5 text-primary" strokeWidth={2.5} />
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <button
      type="button"
      onclick={() => {
        layout = removeField(layout, field.id);
        resetDraft(field.id);
      }}
      disabled={!canRemoveField(layout)}
      title={canRemoveField(layout)
        ? m.gross_seemly_crossbill_nail()
        : m.quaint_next_chipmunk_earn()}
      data-testid={`field-remove-${field.id}`}
      aria-label={m.gross_seemly_crossbill_nail()}
      class="btn btn-square text-base-content/40 btn-ghost btn-xs hover:bg-error/10 hover:text-error"
    >
      ✕
    </button>
  </div>

  {#if isDupLabel}
    <p id={`dup-${field.id}`} class="px-2 text-xs text-error">{m.upper_aqua_oryx_snap()}</p>
  {/if}

  {#if field.kind === 'list'}
    <div class="rounded-box border border-base-300 bg-base-200/40 p-2">
      <input
        type="text"
        placeholder={m.still_lazy_bear_honor()}
        disabled
        class="input-bordered input input-sm w-full bg-base-100"
      />
    </div>
  {:else}
    <input
      type={inputTypeFor(field.kind)}
      disabled
      placeholder={field.kind === 'number' ? '0' : ''}
      class="input-bordered input w-full bg-base-200/40"
    />
  {/if}
  <div class="flex flex-wrap items-start gap-x-4 gap-y-2 px-1 text-xs">
    <label class="flex cursor-pointer items-center gap-1.5 pt-1.5">
      <input
        type="checkbox"
        class="checkbox checkbox-xs"
        checked={!!field.required}
        data-testid={`field-required-${field.id}`}
        onchange={(e) => (layout = setFieldRequired(layout, field.id, e.currentTarget.checked))}
      />
      <span>{m.polite_stale_ostrich_foster()}</span>
    </label>
    {#if supportsDefault(field.kind)}
      {@const draft = drafts[field.id] ?? defaultToText(field.kind, field.defaultValue)}
      <label class="flex min-w-0 flex-1 items-start gap-2">
        <span class="shrink-0 pt-1.5">{m.quiet_gaudy_elk_skip()}</span>
        {#if field.kind === 'list' || field.kind === 'markdown'}
          <textarea
            rows="2"
            value={draft}
            placeholder={field.kind === 'list' ? m.neat_hour_cougar_hunt() : ''}
            data-testid={`field-default-${field.id}`}
            aria-invalid={badDefault[field.id] ? 'true' : undefined}
            aria-describedby={badDefault[field.id] ? `default-err-${field.id}` : undefined}
            oninput={(e) => onDefaultInput(field, e.currentTarget.value)}
            class="textarea-bordered textarea min-w-0 flex-1 textarea-sm"
          ></textarea>
        {:else}
          <input
            type={inputTypeFor(field.kind)}
            value={draft}
            data-testid={`field-default-${field.id}`}
            aria-invalid={badDefault[field.id] ? 'true' : undefined}
            aria-describedby={badDefault[field.id] ? `default-err-${field.id}` : undefined}
            oninput={(e) => onDefaultInput(field, e.currentTarget.value)}
            class="input-bordered input input-sm min-w-0 flex-1"
          />
        {/if}
      </label>
    {/if}
  </div>
  {#if badDefault[field.id]}
    <p id={`default-err-${field.id}`} role="alert" class="px-2 text-xs text-error">
      {m.steep_bright_manatee_learn()}
    </p>
  {/if}
{/snippet}

<ul class="flex flex-col gap-4">
  {#each layout.fields as field (field.id)}
    <li class="flex flex-col gap-1.5">
      {@render fieldRowContent(field)}
    </li>
  {/each}
</ul>
