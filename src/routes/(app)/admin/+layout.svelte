<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import * as m from '$lib/paraglide/messages.js';

  let { children }: { children: Snippet } = $props();

  const tabs = $derived([
    { href: resolve('/(app)/admin'), label: m.brief_simple_wren_fulfill() },
    { href: resolve('/(app)/admin/groups'), label: m.witty_empty_crow_hunt() },
    { href: resolve('/(app)/admin/grants'), label: m.honest_cuddly_midge_gaze() },
  ]);
</script>

<svelte:head><title>{m.bad_jolly_toad_spark()}</title></svelte:head>

<div class="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5">
  <h2 class="mb-3 text-lg font-semibold">{m.bad_jolly_toad_spark()}</h2>
  <div role="tablist" class="tabs-border mb-4 tabs">
    {#each tabs as tab (tab.href)}
      <a
        role="tab"
        href={tab.href}
        class={['tab', page.url.pathname === tab.href && 'tab-active']}
        aria-current={page.url.pathname === tab.href ? 'page' : undefined}>{tab.label}</a
      >
    {/each}
  </div>
  {@render children()}
</div>
