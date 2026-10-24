<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import { asText, byWriteTo, present } from '$lib/render/select';
  import RowShell from '../_shared/RowShell.svelte';
  import PartyRoute from '../_shared/PartyRoute.svelte';

  let { fields, type, creator, createdAt, status }: RendererProps = $props();

  const title = $derived(byWriteTo(fields, 'title'));
</script>

<RowShell {creator} {createdAt} {status}>
  <span class="shrink-0 text-sm" style="color:{type.color}" aria-hidden="true">✈</span>
  <PartyRoute {fields} {creator} color={type.color} />
  {#if present(title)}
    <span class="truncate text-stone-600">{asText(title.value)}</span>
  {/if}
</RowShell>
