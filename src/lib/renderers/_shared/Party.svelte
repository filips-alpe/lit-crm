<script lang="ts">
  import PersonChip from './PersonChip.svelte';
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import type { RendererProps } from '$lib/render/props';

  // One end of a correspondence. External parties are clickable PersonChips
  // (they filter the timeline); the account holder is shown with their own
  // avatar and handwritten name, but not as a link.
  let {
    name,
    external,
    color,
    account = null,
    compact = false,
    class: className,
  }: {
    name: string;
    external: boolean;
    color: string;
    account?: RendererProps['creator'];
    compact?: boolean;
    class?: string;
  } = $props();

  const accountUser = $derived(account ?? { username: name, name, color, avatarSeed: name });
</script>

{#if external}
  <PersonChip {name} {color} {compact} class={className} />
{:else}
  <span class={['inline-flex min-w-0 items-center gap-1.5', className]}>
    <AvatarImage user={accountUser} class="{compact ? 'size-5' : 'size-6'} shrink-0" />
    <span
      class={['truncate font-hand leading-tight text-stone-800', compact ? 'text-base' : 'text-lg']}
      >{name}</span
    >
  </span>
{/if}
