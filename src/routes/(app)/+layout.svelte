<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { builtinNavItems, mergeNav } from '$lib/extensions/nav';
  import { extensionNavItems } from '$extensions/nav';
  import { extensionShell } from '$extensions/shell';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const nav = $derived(mergeNav(builtinNavItems(), extensionNavItems, data.user));
  // An extension's shell replaces the header and wraps the page; without one the app is as it was.
  const Layout = extensionShell.Layout;
</script>

{#if Layout}
  <Layout user={data.user} {nav}>
    {@render children()}
  </Layout>
{:else}
  <Navigation user={data.user} {nav} />
  {@render children()}
{/if}
