<script lang="ts">
  import type { RendererProps } from '$lib/render/props';
  import Party from './Party.svelte';
  import { resolveParties } from './parties';

  // A letter's sender → recipient pair as inline row content; the account
  // holder stands in for whichever end the record leaves blank.
  let {
    fields,
    creator,
    color,
  }: { fields: RendererProps['fields']; creator: RendererProps['creator']; color: string } =
    $props();

  const parties = $derived(resolveParties(fields, creator?.name ?? null));
</script>

{#if parties.sender}
  <Party
    name={parties.sender.name}
    external={parties.sender.external}
    {color}
    account={creator}
    class="shrink-0"
  />
{/if}
{#if parties.sender && parties.recipient}
  <span class="shrink-0 text-stone-400">→</span>
{/if}
{#if parties.recipient}
  <Party
    name={parties.recipient.name}
    external={parties.recipient.external}
    {color}
    account={creator}
    class="shrink-0"
  />
{/if}
