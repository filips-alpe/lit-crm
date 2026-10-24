<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, present } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';
  import PartyRoute from '../_shared/PartyRoute.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));
</script>

<RowShell {creator} {createdAt} {status}>
  <svg
    class="size-4 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke={type.color}
    stroke-width="1.6"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="2.5" y="4.5" width="19" height="15" rx="1.5" />
    <path d="M14 4.5 V19.5 M17 8 H19 M17 11 H19" />
  </svg>
  <PartyRoute {fields} {creator} color={type.color} />
  {#if present(title)}
    <span class="truncate text-stone-600">{asText(title.value)}</span>
  {/if}
</RowShell>
