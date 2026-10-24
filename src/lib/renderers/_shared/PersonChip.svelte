<script lang="ts">
  import { resolve } from '$app/paths';
  import AvatarImage from '$lib/components/AvatarImage.svelte';

  // A correspondent rendered as a generated avatar + handwritten name, linking
  // to the timeline filtered to that person (to/from contains). Inert inside
  // the renderer picker preview, which wraps previews in pointer-events-none.
  // Lifted (relative z-10) so it stays clickable over a stretched record link.
  let {
    name,
    color,
    compact = false,
    class: className,
  }: {
    name: string;
    color: string;
    /** Smaller avatar + text, for dense renderers. */
    compact?: boolean;
    class?: string;
  } = $props();

  const user = $derived({ username: name, color, avatarSeed: name });
  const href = $derived(resolve('/(app)/data') + '?correspondent=' + encodeURIComponent(name));
</script>

<!-- href is resolve()-built but carries a query string, which the rule can't verify -->
<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {href} class={['group relative z-10 inline-flex min-w-0 items-center gap-1.5', className]}>
  <AvatarImage {user} class="{compact ? 'size-5' : 'size-6'} shrink-0 ring-1 ring-stone-300" />
  <span
    class={[
      'truncate font-hand leading-tight text-stone-800 group-hover:underline',
      compact ? 'text-base' : 'text-lg',
    ]}>{name}</span
  >
</a>
