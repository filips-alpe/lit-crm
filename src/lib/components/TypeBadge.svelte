<script lang="ts">
  import { iconUrl } from '$lib/icons/typeIcons';

  let {
    code,
    color,
    iconSeed,
    decorative = false,
    class: className = 'size-10 rounded-xl',
  }: {
    code: string;
    color: string;
    iconSeed: string | null | undefined;
    /** The code is printed next to the badge: hide it from assistive tech. */
    decorative?: boolean;
    class?: string;
  } = $props();

  const src = $derived(iconUrl(iconSeed, code, color.replace(/^#/, '')));
</script>

<div
  class={['overflow-hidden ring-2', className]}
  style="background-color: {color}; --tw-ring-color: {color}"
  title={decorative ? undefined : code}
>
  <img {src} alt={decorative ? '' : code} loading="lazy" decoding="async" class="size-full" />
</div>
