<script lang="ts">
  import { readableTextColor } from '$lib/utils/contrast';
  import { getRecordOptions } from '$lib/forms/recordOptions';
  import * as m from '$lib/paraglide/messages.js';

  // The universal project field: a chip toggles membership. Reads the project
  // list from the record-options context; the selection is owned by the form.
  let { selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void } = $props();

  const { projects } = getRecordOptions();

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  }
</script>

{#if projects.length}
  <fieldset class="flex flex-col gap-1">
    <legend class="text-xs font-medium text-stone-600">{m.tiny_few_skunk_sail()}</legend>
    <div class="flex flex-wrap gap-1.5">
      {#each projects as p (p.id)}
        {@const on = selected.includes(p.id)}
        <button
          type="button"
          aria-pressed={on}
          onclick={() => toggle(p.id)}
          class={[
            'rounded-full border px-2.5 py-1 text-xs font-medium transition',
            on ? 'border-transparent' : 'border-stone-300 text-stone-600 hover:bg-stone-50',
          ]}
          style={on
            ? `background-color: ${p.color}; color: ${readableTextColor(p.color)}`
            : undefined}
        >
          {p.code}
        </button>
      {/each}
    </div>
  </fieldset>
{/if}
