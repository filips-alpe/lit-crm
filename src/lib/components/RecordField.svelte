<script lang="ts">
  import * as Form from 'formsnap';
  import type { SuperForm } from 'sveltekit-superforms';
  import type { LayoutField } from '$lib/forms/layout';
  import { getFieldInput } from '$lib/fields/inputs';

  let { sf, field }: { sf: SuperForm<Record<string, unknown>>; field: LayoutField } = $props();

  // sf is created once by the parent and never swapped — its stores are stable.
  // svelte-ignore state_referenced_locally
  const { form: formData, errors } = sf;
  const Input = $derived(getFieldInput(field.kind));
  const fieldError = $derived.by(() => {
    const e = ($errors as unknown as Record<string, string[] | undefined>)[field.writeTo];
    return e && e.length > 0 ? e[0] : undefined;
  });
</script>

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
      </div>
    {/snippet}
  </Form.Control>
  {#if fieldError}
    <p class="mt-1 text-sm text-red-600">{fieldError}</p>
  {/if}
</Form.Field>
