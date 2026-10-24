<script lang="ts">
  import type { FieldInputProps } from '../inputs';
  import { fromInputValue, inputBorder, inputTypeFor, toInputValue } from '../inputHelpers';

  let { value, field, controlProps, hasError, onChange }: FieldInputProps = $props();

  const type = $derived(inputTypeFor(field.kind));

  const display = $derived(toInputValue(type, value));

  function handle(raw: string) {
    if (field.kind === 'number') {
      onChange(raw === '' ? undefined : Number(raw));
    } else if (field.kind === 'date' || field.kind === 'datetime') {
      // A cleared date must read as "no value", not '' (which z.coerce.date rejects).
      onChange(fromInputValue(field.kind, raw));
    } else {
      onChange(raw);
    }
  }
</script>

<input
  {...controlProps}
  {type}
  value={display}
  oninput={(e) => handle(e.currentTarget.value)}
  class={['w-full rounded border px-2 py-1.5', inputBorder(hasError)]}
/>
