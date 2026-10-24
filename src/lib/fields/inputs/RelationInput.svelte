<script lang="ts">
  import type { FieldInputProps } from '../inputs';
  import { inputBorder } from '../inputHelpers';
  import { getRecordOptions } from '$lib/forms/recordOptions';

  let { value, field, controlProps, hasError, onChange }: FieldInputProps = $props();

  // Options come from the form root via context (see $lib/forms/recordOptions).
  const options = getRecordOptions();

  // `user` fields pick a person; `record` fields pick another record.
  const items = $derived(
    field.kind === 'user'
      ? options.users.map((u) => ({ id: u.id, label: u.name }))
      : options.records.map((r) => ({ id: r.id, label: r.label })),
  );

  const current = $derived(typeof value === 'string' ? value : '');
</script>

<select
  {...controlProps}
  value={current}
  onchange={(e) => onChange(e.currentTarget.value === '' ? undefined : e.currentTarget.value)}
  class={['w-full rounded border px-2 py-1.5', inputBorder(hasError)]}
>
  <option value="">—</option>
  {#each items as item (item.id)}
    <option value={item.id}>{item.label}</option>
  {/each}
</select>
