<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<Navigation user={data.user} />
{@render children()}
