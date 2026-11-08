<script lang="ts">
  import * as Form from 'formsnap';
  import type { SuperForm } from 'sveltekit-superforms';
  import type { LayoutField } from '$lib/forms/layout';
  import { getFieldInput } from '$lib/fields/inputs';
  import { getRecordOptions } from '$lib/forms/recordOptions';
  import * as m from '$lib/paraglide/messages.js';

  let { sf, field }: { sf: SuperForm<Record<string, unknown>>; field: LayoutField } = $props();

  // sf is created once by the parent and never swapped — its stores are stable.
  // svelte-ignore state_referenced_locally
  const { form: formData, errors } = sf;
  const access = getRecordOptions().access;
  // An amount the database hides is shown as "hidden" (not as empty) and is never posted.
  const masked = $derived(!!access?.maskedColumns.includes(field.writeTo));
  const creatorLocked = $derived(!!access?.lockCreator && field.writeTo === 'creatorId');
  const locked = $derived(!!access?.readOnly || creatorLocked);
  const Input = $derived(getFieldInput(field.kind));
  const fieldError = $derived.by(() => {
    const e = ($errors as unknown as Record<string, string[] | undefined>)[field.writeTo];
    return e && e.length > 0 ? e[0] : undefined;
  });
</script>

{#if masked}
  <div class="flex flex-col gap-1" data-masked={field.writeTo}>
    <span class="text-xs font-medium text-stone-600">{field.label}</span>
    <span
      class="rounded border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-500 italic"
      >{m.this_game_deer_jolt()}</span
    >
  </div>
{:else}
  <fieldset disabled={locked} class="m-0 min-w-0 border-0 p-0">
    <Form.Field form={sf} name={field.writeTo}>
      <Form.Control>
        {#snippet children({ props })}
          <!-- A <div>, not a wrapping <label>: list and location inputs hold several
               controls of their own. Form.Label points at the primary control's id. -->
          <div class="flex flex-col gap-1">
            <Form.Label class="text-xs font-medium text-stone-600">
              {field.label}{field.required ? ' *' : ''}
            </Form.Label>
            <Input
              {field}
              controlProps={props}
              value={$formData[field.writeTo]}
              hasError={!!fieldError}
              onChange={(v) => (($formData[field.writeTo] as unknown) = v)}
            />
            {#if creatorLocked && !access?.readOnly}
              <p class="text-xs text-stone-500">{m.main_slow_stork_embrace()}</p>
            {/if}
          </div>
        {/snippet}
      </Form.Control>
      {#if fieldError}
        <p class="mt-1 text-sm text-red-600">{fieldError}</p>
      {/if}
    </Form.Field>
  </fieldset>
{/if}
