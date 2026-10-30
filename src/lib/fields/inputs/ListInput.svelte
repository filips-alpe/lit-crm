<script lang="ts">
  import type { FieldInputProps } from '../inputs';
  import { inputBorder } from '../inputHelpers';
  import * as m from '$lib/paraglide/messages.js';

  let { value, field, controlProps, hasError, onChange }: FieldInputProps = $props();

  const items = $derived(Array.isArray(value) ? (value as string[]) : []);
  let pending = $state('');

  function commit() {
    const trimmed = pending.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    pending = '';
  }

  function remove(index: number) {
    const next = [...items];
    next.splice(index, 1);
    onChange(next);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  }

  function isUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }
</script>

<div class={['flex flex-col gap-1.5 rounded border px-2 py-1.5', inputBorder(hasError)]}>
  {#if items.length > 0}
    <ul class="flex flex-wrap gap-1">
      {#each items as item, i (`${i}:${item}`)}
        <li
          data-testid={`list-chip-${field.writeTo}-${i}`}
          class="inline-flex items-center gap-2 rounded border border-stone-300 bg-stone-50 px-2 py-0.5 text-sm"
        >
          {#if isUrl(item)}
            <!-- eslint-disable svelte/no-navigation-without-resolve -- external source link -->
            <a
              href={item}
              target="_blank"
              rel="noopener noreferrer"
              class="underline hover:text-blue-600"
            >
              {item}
            </a>
            <!-- eslint-enable svelte/no-navigation-without-resolve -->
          {:else}
            <span>{item}</span>
          {/if}
          <button
            type="button"
            aria-label={m.brief_flaky_mammoth_stab({ item })}
            data-testid={`list-chip-remove-${field.writeTo}-${i}`}
            onclick={() => remove(i)}
            class="rounded px-1 text-xs text-stone-500 hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <input
    {...controlProps}
    aria-label={field.label}
    type="text"
    placeholder={m.spry_curly_wombat_lend()}
    bind:value={pending}
    onkeydown={onKeydown}
    onblur={commit}
    data-testid={`list-input-${field.writeTo}`}
    class="w-full rounded border border-stone-200 px-2 py-1 text-sm"
  />
</div>
