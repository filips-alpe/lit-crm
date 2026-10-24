<script lang="ts">
  import TypeBadge from '$lib/components/TypeBadge.svelte';
  import * as m from '$lib/paraglide/messages.js';

  type Option = {
    id: string;
    code: string;
    color: string;
    iconSeed: string | null;
    status?: 'ACTIVE' | 'INACTIVE';
  };

  let {
    options,
    activeId,
    hrefFor,
  }: {
    options: Option[];
    activeId: string | null;
    hrefFor: (id: string | null) => string;
  } = $props();
</script>

<div
  class="-mx-4 flex items-stretch gap-0 overflow-x-auto border-b border-stone-200 px-4 sm:-mx-6 sm:px-6"
>
  <!-- href is the current route with a modified query string, which resolve() can't express -->
  <!-- eslint-disable svelte/no-navigation-without-resolve -->
  <a
    href={hrefFor(null)}
    class="border-b-2 px-3 py-1.5 whitespace-nowrap {!activeId
      ? 'border-stone-800 text-stone-900'
      : 'border-transparent text-stone-500 hover:text-stone-700'}"
    aria-current={!activeId ? 'page' : undefined}
  >
    {m.knotty_alert_cow_jest()}
  </a>
  {#each options as opt (opt.id)}
    {@const active = opt.id === activeId}
    <a
      href={hrefFor(opt.id)}
      class="inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 whitespace-nowrap {active
        ? 'border-stone-800 text-stone-900'
        : 'border-transparent text-stone-500 hover:text-stone-700'} {opt.status === 'INACTIVE'
        ? 'opacity-60'
        : ''}"
      aria-current={active ? 'page' : undefined}
      style={active ? `border-color: ${opt.color}` : undefined}
    >
      <TypeBadge
        code={opt.code}
        color={opt.color}
        iconSeed={opt.iconSeed}
        class="size-4 rounded-sm"
      />
      <span>{opt.code}</span>
    </a>
  {/each}
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
</div>
