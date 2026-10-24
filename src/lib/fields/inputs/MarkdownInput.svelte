<script lang="ts">
  import type { FieldInputProps } from '../inputs';
  import { inputBorder } from '../inputHelpers';

  // Long-form Markdown source: a plain multiline textarea. The formatted preview
  // is the renderer's concern (see $lib/components/Markdown); the entry form just
  // edits the raw source.
  let { value, controlProps, hasError, onChange }: FieldInputProps = $props();

  const display = $derived(typeof value === 'string' ? value : value == null ? '' : String(value));
</script>

<textarea
  {...controlProps}
  rows="10"
  value={display}
  oninput={(e) => onChange(e.currentTarget.value)}
  class={[
    'w-full rounded border px-2 py-1.5 font-mono text-sm leading-relaxed',
    inputBorder(hasError),
  ]}
></textarea>
