<script lang="ts">
  import type { FieldInputProps } from '../inputs';
  import { inputBorder } from '../inputHelpers';
  import * as m from '$lib/paraglide/messages.js';

  let { value, field, controlProps, hasError, onChange }: FieldInputProps = $props();

  function split(v: unknown): { lat: string; lng: string } {
    if (typeof v !== 'string') return { lat: '', lng: '' };
    const parts = v.split(',');
    if (parts.length !== 2) return { lat: '', lng: '' };
    return { lat: parts[0].trim(), lng: parts[1].trim() };
  }

  // Fully controlled from `value`: the two boxes always reflect the stored
  // "lat,lng" string (incl. a half-filled "51.5," while the user is mid-entry).
  const parts = $derived(split(value));

  // The longitude box has no id/name of its own (they stay with the latitude box,
  // which the label points at), but it shares the invalid/described-by state.
  const stateProps = $derived({
    'aria-invalid': controlProps['aria-invalid'] as boolean | 'true' | undefined,
    'aria-describedby': controlProps['aria-describedby'] as string | undefined,
  });

  function combine(a: string, b: string) {
    const ta = a.trim();
    const tb = b.trim();
    // Empty → undefined so the optional schema passes; one side filled keeps the
    // partial pair so the other box's value survives (it just fails validation
    // until both are present).
    onChange(ta === '' && tb === '' ? undefined : `${ta},${tb}`);
  }
</script>

<div class="flex gap-2">
  <div class="flex flex-1 flex-col gap-0.5">
    <span aria-hidden="true" class="text-[10px] tracking-wide text-stone-400 uppercase"
      >{m.next_livid_hare_lend()}</span
    >
    <input
      {...controlProps}
      aria-label={m.next_livid_hare_lend()}
      type="number"
      step="any"
      placeholder="51.5"
      value={parts.lat}
      oninput={(e) => combine(e.currentTarget.value, parts.lng)}
      data-testid={`location-lat-${field.writeTo}`}
      class={['w-full rounded border px-2 py-1.5', inputBorder(hasError)]}
    />
  </div>
  <div class="flex flex-1 flex-col gap-0.5">
    <span aria-hidden="true" class="text-[10px] tracking-wide text-stone-400 uppercase"
      >{m.born_simple_grizzly_blend()}</span
    >
    <input
      {...stateProps}
      aria-label={m.born_simple_grizzly_blend()}
      type="number"
      step="any"
      placeholder="-0.1"
      value={parts.lng}
      oninput={(e) => combine(parts.lat, e.currentTarget.value)}
      data-testid={`location-lng-${field.writeTo}`}
      class={['w-full rounded border px-2 py-1.5', inputBorder(hasError)]}
    />
  </div>
</div>
